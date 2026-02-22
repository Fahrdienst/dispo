#!/usr/bin/env python3
"""
One-time import of legacy Excel data into Supabase.

Usage:
    pip install openpyxl supabase
    python3 scripts/import-excel.py

Reads Supabase credentials from .env.local (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
"""
from __future__ import annotations

import os
import re
import sys
from datetime import datetime, date, time
from pathlib import Path

import openpyxl
from supabase import create_client, Client

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

EXCEL_PATH = Path.home() / "Downloads" / "Fahrdienst_Dübendorf_Daten.xlsx"
ENV_FILE = Path(__file__).resolve().parent.parent / ".env.local"
BATCH_SIZE = 500  # Supabase REST upsert batch size

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def load_env(path: Path) -> dict[str, str]:
    """Parse .env.local into dict."""
    env = {}
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            key, _, value = line.partition("=")
            env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def split_address(addr: str | None) -> tuple[str | None, str | None]:
    """Split 'Giessenstr. 13' into ('Giessenstr.', '13').

    Handles cases like:
    - 'Giessenstr. 13' -> ('Giessenstr.', '13')
    - 'Giessenstr. 13a' -> ('Giessenstr.', '13a')
    - 'Wilstr. 2-4' -> ('Wilstr.', '2-4')
    - 'Überlandstrasse 359 / 4. OG' -> ('Überlandstrasse', '359 / 4. OG')
    - None -> (None, None)
    """
    if not addr:
        return None, None
    addr = addr.strip()
    # Match: last word-boundary followed by digits (optionally with letter/dash suffix)
    m = re.match(r"^(.+?)\s+(\d+\S*)$", addr)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    # No house number found — put everything in street
    return addr, None


def format_phone(val: str | None) -> str | None:
    """Normalize phone: keep digits, spaces, +, /."""
    if not val:
        return None
    s = str(val).strip()
    if not s:
        return None
    return s


def pick_phone(row: dict, mobile_key: str, telefon_key: str) -> str | None:
    """Pick Mobile if available, else Telefon."""
    mobile = format_phone(row.get(mobile_key))
    telefon = format_phone(row.get(telefon_key))
    return mobile or telefon


def parse_aktiv(val: str | None) -> bool:
    """'Ja' -> True, else False."""
    return str(val).strip().lower() == "ja" if val else False


def safe_str(val) -> str | None:
    """Convert value to trimmed string or None."""
    if val is None:
        return None
    s = str(val).strip()
    return s if s else None


def safe_plz(val) -> str | None:
    """Convert PLZ to 4-digit string."""
    if val is None:
        return None
    s = str(int(val)) if isinstance(val, (int, float)) else str(val).strip()
    return s.zfill(4) if s else None


def parse_excel_date(val) -> str | None:
    """Parse date from Excel cell -> 'YYYY-MM-DD'."""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.strftime("%Y-%m-%d")
    if isinstance(val, date):
        return val.strftime("%Y-%m-%d")
    # String like '07/01/25 00:00:00'
    s = str(val).strip()
    for fmt in ("%m/%d/%y %H:%M:%S", "%m/%d/%y", "%Y-%m-%d", "%d.%m.%Y"):
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def parse_excel_time(val) -> str | None:
    """Parse time from Excel cell -> 'HH:MM:SS'.

    Excel time-only values often use base date 1899-12-30.
    """
    if val is None:
        return None
    if isinstance(val, time):
        return val.strftime("%H:%M:%S")
    if isinstance(val, datetime):
        return val.strftime("%H:%M:%S")
    # String like '12/30/99 12:30:00'
    s = str(val).strip()
    for fmt in ("%m/%d/%y %H:%M:%S", "%H:%M:%S", "%H:%M"):
        try:
            return datetime.strptime(s, fmt).strftime("%H:%M:%S")
        except ValueError:
            continue
    return None


def map_status(val, ride_date: str | None = None) -> str:
    """Map legacy numeric status to ride_status enum.

    Referenzdaten:
    1 = unvollständig  -> unplanned
    2 = erfasst und ok -> unplanned
    3 = An Fahrer zugewiesen -> planned
    4 = An Fahrer versendet -> planned
    5 = Fahrer hat bestätigt -> confirmed (future) / completed (past)
    6 = storniert -> cancelled
    """
    try:
        code = int(val)
    except (ValueError, TypeError):
        return "unplanned"

    if code == 5:
        # Status 5 = "Fahrer hat bestätigt": for past rides treat as completed,
        # for today or future rides treat as confirmed (not yet done).
        today = date.today().isoformat()
        if ride_date and ride_date >= today:
            return "confirmed"
        return "completed"

    status_map = {
        1: "unplanned",
        2: "unplanned",
        3: "planned",
        4: "planned",
        6: "cancelled",
    }
    return status_map.get(code, "unplanned")


def map_facility_type(art: str | None) -> str:
    """Best-effort mapping of free-text Art to facility_type enum."""
    if not art:
        return "other"
    a = art.lower().strip()
    if any(w in a for w in ("spital", "klinik", "hospital", "universitätsspital")):
        return "hospital"
    if any(w in a for w in ("physio", "ergo", "therapie", "rehab", "rehabilitation", "logopäd")):
        return "therapy_center"
    if any(w in a for w in ("arzt", "praxis", "zahnarzt", "augen", "dermat", "gynäk", "urolog",
                             "kardiolog", "neurolog", "radiolog", "onkolog", "hämat", "gastro",
                             "pneum", "rheumat", "chirurg", "orthopäd", "hno", "labor")):
        return "practice"
    if any(w in a for w in ("heim", "alters", "pflege", "tagesstätte", "tagesstruktur",
                             "tageszentr", "tageszentrum")):
        return "day_care"
    return "other"


def parse_impairments(behinderung: str | None) -> list[str]:
    """Extract impairment_type values from free-text Behinderung field.

    impairment_type enum: rollator, wheelchair, stretcher, companion
    """
    if not behinderung:
        return []
    b = behinderung.lower()
    impairments = []
    if "rollator" in b or "rolator" in b:
        impairments.append("rollator")
    if "rollstuhl" in b:
        impairments.append("wheelchair")
    # 'Bahre/Trage' for stretcher — unlikely in this data but check anyway
    if "bahre" in b or "trage" in b or "liegend" in b:
        impairments.append("stretcher")
    # Companion: begleiten, Begleitung, Demenz (needs escort)
    if any(w in b for w in ("begleit", "dement", "demenz")):
        impairments.append("companion")
    return impairments


def sheet_to_dicts(ws) -> list[dict]:
    """Convert worksheet to list of dicts using header row."""
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return []
    headers = [str(h).strip() if h else f"col_{i}" for i, h in enumerate(rows[0])]
    return [dict(zip(headers, row)) for row in rows[1:]]


def batch_insert(supabase: Client, table: str, records: list[dict]) -> int:
    """Insert records in batches, return count of inserted rows."""
    total = 0
    for i in range(0, len(records), BATCH_SIZE):
        batch = records[i : i + BATCH_SIZE]
        result = supabase.table(table).insert(batch).execute()
        total += len(result.data)
    return total


# ---------------------------------------------------------------------------
# Main import logic
# ---------------------------------------------------------------------------


def main():
    # Load env
    if not ENV_FILE.exists():
        print(f"ERROR: {ENV_FILE} not found")
        sys.exit(1)
    env = load_env(ENV_FILE)
    url = env.get("SUPABASE_URL") or env.get("NEXT_PUBLIC_SUPABASE_URL")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local")
        sys.exit(1)

    supabase: Client = create_client(url, key)

    # Load Excel
    if not EXCEL_PATH.exists():
        print(f"ERROR: Excel file not found: {EXCEL_PATH}")
        sys.exit(1)
    print(f"Loading {EXCEL_PATH} ...")
    wb = openpyxl.load_workbook(str(EXCEL_PATH), read_only=True, data_only=True)

    # -----------------------------------------------------------------------
    # 1. Patienten
    # -----------------------------------------------------------------------
    print("\n--- Patienten ---")
    patients_raw = sheet_to_dicts(wb["Patienten"])
    patient_id_map: dict[int, str] = {}  # old ID -> new UUID
    patient_records = []

    for row in patients_raw:
        old_id = int(row["ID"])
        street, house_number = split_address(safe_str(row.get("Adresse")))
        phone = pick_phone(row, "Mobile", "Telefon")

        # Build notes: combine Bemerkungen + any non-parseable Behinderung text
        behinderung_text = safe_str(row.get("Behinderung"))
        bemerkungen = safe_str(row.get("Bemerkungen"))
        notes_parts = []
        if bemerkungen:
            notes_parts.append(bemerkungen)
        if behinderung_text:
            # Add full original text to notes for reference
            notes_parts.append(f"Behinderung: {behinderung_text}")
        notes = "\n".join(notes_parts) if notes_parts else None

        record = {
            "first_name": safe_str(row.get("Vorname")) or "–",
            "last_name": safe_str(row.get("Nachname")) or "–",
            "street": street,
            "house_number": house_number,
            "postal_code": safe_plz(row.get("PLZ")),
            "city": safe_str(row.get("Ort")),
            "phone": phone,
            "notes": notes,
            "is_active": parse_aktiv(row.get("Aktiv")),
        }
        patient_records.append((old_id, record))

    # Insert patients and build ID map
    to_insert = [r for _, r in patient_records]
    count = 0
    for i in range(0, len(to_insert), BATCH_SIZE):
        batch = to_insert[i : i + BATCH_SIZE]
        result = supabase.table("patients").insert(batch).execute()
        for j, data_row in enumerate(result.data):
            old_id = patient_records[i + j][0]
            patient_id_map[old_id] = data_row["id"]
        count += len(result.data)

    print(f"  Inserted: {count} patients")
    print(f"  ID map size: {len(patient_id_map)}")

    # -----------------------------------------------------------------------
    # 2. Patient Impairments
    # -----------------------------------------------------------------------
    print("\n--- Patient Impairments ---")
    impairment_records = []
    for row in patients_raw:
        old_id = int(row["ID"])
        uuid = patient_id_map.get(old_id)
        if not uuid:
            continue
        impairments = parse_impairments(safe_str(row.get("Behinderung")))
        for imp in impairments:
            impairment_records.append({
                "patient_id": uuid,
                "impairment_type": imp,
            })

    if impairment_records:
        imp_count = batch_insert(supabase, "patient_impairments", impairment_records)
        print(f"  Inserted: {imp_count} impairments")
    else:
        print("  No impairments found")

    # -----------------------------------------------------------------------
    # 3. Zieladressen (Destinations)
    # -----------------------------------------------------------------------
    print("\n--- Zieladressen ---")
    destinations_raw = sheet_to_dicts(wb["Zieladressen"])
    dest_id_map: dict[int, str] = {}  # old ID -> new UUID

    dest_records = []
    for row in destinations_raw:
        old_id = int(row["ID"])
        street, house_number = split_address(safe_str(row.get("Adresse")))

        record = {
            "display_name": safe_str(row.get("Name")) or "–",
            "facility_type": map_facility_type(safe_str(row.get("Art"))),
            "street": street,
            "house_number": house_number,
            "postal_code": safe_plz(row.get("PLZ")),
            "city": safe_str(row.get("Ort")),
            "contact_phone": format_phone(row.get("Telefon")),
            "comment": safe_str(row.get("Bemerkungen")),
            "is_active": parse_aktiv(row.get("Aktiv")),
        }
        dest_records.append((old_id, record))

    to_insert = [r for _, r in dest_records]
    count = 0
    for i in range(0, len(to_insert), BATCH_SIZE):
        batch = to_insert[i : i + BATCH_SIZE]
        result = supabase.table("destinations").insert(batch).execute()
        for j, data_row in enumerate(result.data):
            old_id = dest_records[i + j][0]
            dest_id_map[old_id] = data_row["id"]
        count += len(result.data)

    print(f"  Inserted: {count} destinations")
    print(f"  ID map size: {len(dest_id_map)}")

    # -----------------------------------------------------------------------
    # 4. Fahrer (Drivers)
    # -----------------------------------------------------------------------
    print("\n--- Fahrer ---")
    drivers_raw = sheet_to_dicts(wb["Fahrer"])
    driver_id_map: dict[int, str] = {}  # old ID -> new UUID

    driver_records = []
    for row in drivers_raw:
        old_id = int(row["ID"])
        street, house_number = split_address(safe_str(row.get("Adresse")))

        record = {
            "first_name": safe_str(row.get("Vorname")) or "–",
            "last_name": safe_str(row.get("Nachname")) or "–",
            "street": street,
            "house_number": house_number,
            "postal_code": safe_plz(row.get("PLZ")),
            "city": safe_str(row.get("Ort")),
            "phone": pick_phone(row, "Mobile", "Telefon"),
            "email": safe_str(row.get("Email")),
            "vehicle": safe_str(row.get("Fahrzeug")),
            "notes": safe_str(row.get("Eigenschaften")),
            "is_active": parse_aktiv(row.get("Aktiv")),
        }
        driver_records.append((old_id, record))

    to_insert = [r for _, r in driver_records]
    count = 0
    for i in range(0, len(to_insert), BATCH_SIZE):
        batch = to_insert[i : i + BATCH_SIZE]
        result = supabase.table("drivers").insert(batch).execute()
        for j, data_row in enumerate(result.data):
            old_id = driver_records[i + j][0]
            driver_id_map[old_id] = data_row["id"]
        count += len(result.data)

    print(f"  Inserted: {count} drivers")
    print(f"  ID map size: {len(driver_id_map)}")

    # -----------------------------------------------------------------------
    # 5. Auftraege (Rides)
    # -----------------------------------------------------------------------
    print("\n--- Aufträge ---")
    rides_raw = sheet_to_dicts(wb["Aufträge"])

    ride_records = []
    skipped_no_patient = 0
    skipped_no_dest = 0
    skipped_no_dest_map = 0

    for row in rides_raw:
        patient_old = row.get("Patient_ID")
        dest_old = row.get("Ziel_ID")
        driver_old = row.get("Fahrer_ID")

        # Skip if patient missing/zero
        if not patient_old or int(patient_old) == 0:
            skipped_no_patient += 1
            continue

        # Skip if destination missing/zero
        if not dest_old or int(dest_old) == 0:
            skipped_no_dest += 1
            continue

        patient_uuid = patient_id_map.get(int(patient_old))
        dest_uuid = dest_id_map.get(int(dest_old))
        driver_uuid = driver_id_map.get(int(driver_old)) if driver_old and int(driver_old) != 0 else None

        if not patient_uuid:
            skipped_no_patient += 1
            continue
        if not dest_uuid:
            skipped_no_dest_map += 1
            continue

        ride_date = parse_excel_date(row.get("Datum"))
        if not ride_date:
            continue

        pickup_time = parse_excel_time(row.get("Abholzeit")) or "00:00:00"
        appointment_time = parse_excel_time(row.get("Terminzeit"))

        # DB constraint: pickup_time must be < appointment_time
        if appointment_time and pickup_time >= appointment_time:
            appointment_time = None

        price_raw = row.get("Preis (CHF)")
        price_override = float(price_raw) if price_raw and float(price_raw) > 0 else None

        record = {
            "patient_id": patient_uuid,
            "destination_id": dest_uuid,
            "driver_id": driver_uuid,
            "date": ride_date,
            "pickup_time": pickup_time,
            "appointment_time": appointment_time,
            "status": map_status(row.get("Status"), ride_date),
            "direction": "outbound",
            "notes": safe_str(row.get("Spezielles")),
            "price_override": price_override,
            "price_override_reason": "Import Altsystem" if price_override else None,
            "is_active": True,
        }
        ride_records.append(record)

    count = batch_insert(supabase, "rides", ride_records)
    print(f"  Inserted: {count} rides")
    print(f"  Skipped (no patient): {skipped_no_patient}")
    print(f"  Skipped (no dest ID): {skipped_no_dest}")
    print(f"  Skipped (dest not in map): {skipped_no_dest_map}")

    # -----------------------------------------------------------------------
    # Summary
    # -----------------------------------------------------------------------
    wb.close()
    print("\n=== IMPORT COMPLETE ===")
    print(f"  Patients:     {len(patient_id_map)}")
    print(f"  Impairments:  {len(impairment_records)}")
    print(f"  Destinations: {len(dest_id_map)}")
    print(f"  Drivers:      {len(driver_id_map)}")
    print(f"  Rides:        {count}")
    print(f"  Rides skipped: {skipped_no_patient + skipped_no_dest + skipped_no_dest_map}")


if __name__ == "__main__":
    main()
