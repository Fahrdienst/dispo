#!/usr/bin/env python3
"""
Wipe & re-import from Access backend DB into Supabase.

Replaces the old Excel import with a complete import from the Access DB
(Datenbank_DUEBI_be.accdb), which has all 27 order fields including:
- tafAnzFahrten (1=outbound, 2=outbound+return)
- tafEndeZeit (return ride pickup time)
- tafEinsatzzeit, tafMehrkosten, tafHinweise

Usage:
    pip install supabase
    brew install mdbtools  # if not already installed
    python3 scripts/import-accdb.py            # full wipe & import
    python3 scripts/import-accdb.py --dry-run   # count only, no writes
"""
from __future__ import annotations

import csv
import io
import os
import re
import subprocess
import sys
from datetime import date, datetime, time
from pathlib import Path

from supabase import create_client, Client

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

ACCDB_PATH = Path.home() / "Downloads" / "Datenbank_DUEBI_be.accdb"
ENV_FILE = Path(__file__).resolve().parent.parent / ".env.local"
BATCH_SIZE = 500

# Tables to wipe (FK-safe order: children first)
WIPE_TABLES = [
    "acceptance_tracking",
    "assignment_tokens",
    "mail_log",
    "communication_log",
    "rides",
    "ride_series",
    "patient_impairments",
    "driver_availability",
    "patients",
    "destinations",
    "drivers",
]

# ---------------------------------------------------------------------------
# Access DB reader
# ---------------------------------------------------------------------------


def mdb_export(table: str) -> list[dict]:
    """Export a table from the Access DB to a list of dicts via mdb-export."""
    result = subprocess.run(
        ["mdb-export", str(ACCDB_PATH), table],
        capture_output=True,
        text=True,
        check=True,
    )
    reader = csv.DictReader(io.StringIO(result.stdout))
    return list(reader)


# ---------------------------------------------------------------------------
# Helpers (carried over from import-excel.py)
# ---------------------------------------------------------------------------


def load_env(path: Path) -> dict[str, str]:
    """Parse .env.local into dict."""
    env: dict[str, str] = {}
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            key, _, value = line.partition("=")
            env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def split_address(addr: str | None) -> tuple[str | None, str | None]:
    """Split 'Giessenstr. 13' into ('Giessenstr.', '13')."""
    if not addr:
        return None, None
    addr = addr.strip()
    m = re.match(r"^(.+?)\s+(\d+\S*)$", addr)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return addr, None


def format_phone(val: str | None) -> str | None:
    """Normalize phone: keep as-is, just trim."""
    if not val:
        return None
    s = str(val).strip()
    return s if s else None


def pick_phone(row: dict, mobile_key: str, telefon_key: str) -> str | None:
    """Pick Mobile if available, else Telefon."""
    mobile = format_phone(row.get(mobile_key))
    telefon = format_phone(row.get(telefon_key))
    return mobile or telefon


def safe_str(val: str | None) -> str | None:
    """Convert value to trimmed string or None."""
    if val is None:
        return None
    s = str(val).strip()
    return s if s else None


def safe_plz(val: str | None) -> str | None:
    """Convert PLZ to 4-digit string."""
    if val is None:
        return None
    s = str(val).strip()
    if not s:
        return None
    # Remove decimals (e.g. "8600.0" -> "8600")
    try:
        s = str(int(float(s)))
    except ValueError:
        pass
    return s.zfill(4) if s else None


def parse_csv_date(val: str | None) -> str | None:
    """Parse date from mdb-export CSV -> 'YYYY-MM-DD'.

    mdb-export outputs dates like '07/01/25 00:00:00'.
    """
    if not val:
        return None
    s = str(val).strip()
    if not s:
        return None
    for fmt in ("%m/%d/%y %H:%M:%S", "%m/%d/%y", "%Y-%m-%d", "%d.%m.%Y"):
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def parse_csv_time(val: str | None) -> str | None:
    """Parse time from mdb-export CSV -> 'HH:MM:SS'.

    mdb-export outputs time-only values with base date 1899-12-30,
    e.g. '12/30/99 12:30:00'.
    """
    if not val:
        return None
    s = str(val).strip()
    if not s:
        return None
    for fmt in ("%m/%d/%y %H:%M:%S", "%H:%M:%S", "%H:%M"):
        try:
            return datetime.strptime(s, fmt).strftime("%H:%M:%S")
        except ValueError:
            continue
    return None


def map_status(val: str | None, ride_date: str | None = None) -> str:
    """Map legacy numeric status to ride_status enum.

    1 = unvollständig  -> unplanned
    2 = erfasst und ok -> unplanned
    3 = An Fahrer zugewiesen -> planned
    4 = An Fahrer versendet -> planned
    5 = Fahrer hat bestätigt -> confirmed (future) / completed (past)
    6 = storniert -> cancelled
    """
    try:
        code = int(val)  # type: ignore[arg-type]
    except (ValueError, TypeError):
        return "unplanned"

    if code == 5:
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
    """Extract impairment_type values from free-text Behinderung field."""
    if not behinderung:
        return []
    b = behinderung.lower()
    impairments = []
    if "rollator" in b or "rolator" in b:
        impairments.append("rollator")
    if "rollstuhl" in b:
        impairments.append("wheelchair")
    if "bahre" in b or "trage" in b or "liegend" in b:
        impairments.append("stretcher")
    if any(w in b for w in ("begleit", "dement", "demenz")):
        impairments.append("companion")
    return impairments


def build_ride_notes(
    hinweise: str | None,
    spezielles: str | None,
    einsatzzeit: str | None,
    mehrkosten: str | None,
    auftragstyp: str | None,
) -> str | None:
    """Combine multiple Access fields into a single notes string."""
    parts: list[str] = []

    if auftragstyp == "2":
        parts.append("Dauerauftrag")

    if einsatzzeit:
        try:
            mins = int(float(einsatzzeit))
            if mins > 0:
                parts.append(f"Einsatzzeit: {mins} min")
        except ValueError:
            pass

    if mehrkosten:
        try:
            mk = float(mehrkosten)
            if mk > 0:
                parts.append(f"Mehrkosten: {mk:.2f} CHF")
        except ValueError:
            pass

    if spezielles and spezielles.strip():
        parts.append(spezielles.strip())

    if hinweise and hinweise.strip():
        parts.append(hinweise.strip())

    return " | ".join(parts) if parts else None


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
    dry_run = "--dry-run" in sys.argv

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

    # Check Access DB
    if not ACCDB_PATH.exists():
        print(f"ERROR: Access DB not found: {ACCDB_PATH}")
        sys.exit(1)

    supabase: Client = create_client(url, key)

    if dry_run:
        print("=== DRY RUN MODE — no database writes ===\n")
    else:
        print("=== LIVE MODE — will wipe and re-import ===\n")

    # -------------------------------------------------------------------
    # Phase 0: Read all data from Access DB
    # -------------------------------------------------------------------
    print("Reading Access DB ...")
    patients_raw = mdb_export("tabFahrgastAdressen")
    destinations_raw = mdb_export("tabZielAdressen")
    drivers_raw = mdb_export("tabFahrer")
    rides_raw = mdb_export("tabAuftragsliste")
    print(f"  Patients:     {len(patients_raw)}")
    print(f"  Destinations: {len(destinations_raw)}")
    print(f"  Drivers:      {len(drivers_raw)}")
    print(f"  Orders:       {len(rides_raw)}")

    # -------------------------------------------------------------------
    # Phase 1: Wipe (skip in dry run)
    # -------------------------------------------------------------------
    print("\n--- Phase 1: Wipe ---")
    if dry_run:
        print("  [DRY RUN] Would wipe tables:", ", ".join(WIPE_TABLES))
    else:
        for table in WIPE_TABLES:
            # Delete all rows: filter on id != impossible UUID
            result = supabase.table(table).delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
            count = len(result.data) if result.data else 0
            print(f"  Wiped {table}: {count} rows")

    # -------------------------------------------------------------------
    # Phase 2: Import Stammdaten
    # -------------------------------------------------------------------

    # 2a. Patienten
    print("\n--- Phase 2a: Patienten ---")
    patient_id_map: dict[int, str] = {}
    patient_records: list[tuple[int, dict]] = []

    for row in patients_raw:
        old_id = int(row["Fahrgast_ID"])
        street, house_number = split_address(safe_str(row.get("tfgAbholAdresse")))
        phone = pick_phone(row, "tfgMobile", "tfgTelefon")

        behinderung_text = safe_str(row.get("tfgBehinderung"))
        bemerkungen = safe_str(row.get("tfgBemerkungen"))
        notes_parts: list[str] = []
        if bemerkungen:
            notes_parts.append(bemerkungen)
        if behinderung_text:
            notes_parts.append(f"Behinderung: {behinderung_text}")
        notes = "\n".join(notes_parts) if notes_parts else None

        is_active = row.get("tfgAktuell", "0") == "1"

        record = {
            "first_name": safe_str(row.get("tfgVorname")) or "–",
            "last_name": safe_str(row.get("tfgNachname")) or "–",
            "street": street,
            "house_number": house_number,
            "postal_code": safe_plz(row.get("tfgPostleitzahl")),
            "city": safe_str(row.get("tfgAbholOrt")),
            "phone": phone,
            "notes": notes,
            "is_active": is_active,
        }
        patient_records.append((old_id, record))

    if dry_run:
        print(f"  [DRY RUN] Would insert {len(patient_records)} patients")
    else:
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

    # 2b. Patient Impairments
    print("\n--- Phase 2b: Patient Impairments ---")
    impairment_records: list[dict] = []
    for row in patients_raw:
        old_id = int(row["Fahrgast_ID"])
        if dry_run:
            impairments = parse_impairments(safe_str(row.get("tfgBehinderung")))
            for imp in impairments:
                impairment_records.append({"patient_id": str(old_id), "impairment_type": imp})
        else:
            uuid = patient_id_map.get(old_id)
            if not uuid:
                continue
            impairments = parse_impairments(safe_str(row.get("tfgBehinderung")))
            for imp in impairments:
                impairment_records.append({"patient_id": uuid, "impairment_type": imp})

    if dry_run:
        print(f"  [DRY RUN] Would insert {len(impairment_records)} impairments")
    elif impairment_records:
        imp_count = batch_insert(supabase, "patient_impairments", impairment_records)
        print(f"  Inserted: {imp_count} impairments")
    else:
        print("  No impairments found")

    # 2c. Zieladressen (Destinations)
    print("\n--- Phase 2c: Zieladressen ---")
    dest_id_map: dict[int, str] = {}
    dest_records: list[tuple[int, dict]] = []

    for row in destinations_raw:
        old_id = int(row["tfzFahrziel_ID"])
        street, house_number = split_address(safe_str(row.get("tfzZielAdresse")))
        is_active = row.get("tfzAktuell", "0") == "1"

        record = {
            "display_name": safe_str(row.get("tfzZiel_Name")) or safe_str(row.get("tfzZielOrt")) or "–",
            "facility_type": map_facility_type(safe_str(row.get("tfzZiel_Art"))),
            "street": street,
            "house_number": house_number,
            "postal_code": safe_plz(row.get("tfzPostleitzahl")),
            "city": safe_str(row.get("tfzZielOrt")),
            "contact_phone": format_phone(row.get("tfzTelefon")),
            "comment": safe_str(row.get("tfzBemerkungen")),
            "is_active": is_active,
        }
        dest_records.append((old_id, record))

    if dry_run:
        print(f"  [DRY RUN] Would insert {len(dest_records)} destinations")
    else:
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

    # 2d. Fahrer (Drivers)
    print("\n--- Phase 2d: Fahrer ---")
    driver_id_map: dict[int, str] = {}
    driver_records: list[tuple[int, dict]] = []

    for row in drivers_raw:
        old_id = int(row["tfaFahrerID"])
        street, house_number = split_address(safe_str(row.get("tfaAdresse")))
        is_active = row.get("tfaAktiv", "0") != "0"

        record = {
            "first_name": safe_str(row.get("tfaVorname")) or "–",
            "last_name": safe_str(row.get("tfaNachname")) or "–",
            "street": street,
            "house_number": house_number,
            "postal_code": safe_plz(row.get("tfaPostleitzahl")),
            "city": safe_str(row.get("tfaWohnort")),
            "phone": pick_phone(row, "tfaMobile", "tfaTelefon"),
            "email": safe_str(row.get("tfaEmail")),
            "vehicle": safe_str(row.get("tfaFahrzeug")),
            "notes": safe_str(row.get("tfaEigenschaften")),
            "is_active": is_active,
        }
        driver_records.append((old_id, record))

    if dry_run:
        print(f"  [DRY RUN] Would insert {len(driver_records)} drivers")
    else:
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

    # -------------------------------------------------------------------
    # Phase 3: Import Auftraege with return rides
    # -------------------------------------------------------------------
    print("\n--- Phase 3: Aufträge ---")

    outbound_records: list[dict] = []
    return_records: list[dict] = []  # (index into outbound_records, return record)
    return_parent_indices: list[int] = []  # which outbound ride each return belongs to
    skipped_no_patient = 0
    skipped_no_dest = 0
    skipped_no_date = 0

    for row in rides_raw:
        patient_old = row.get("tafFahrgast_ID", "0")
        dest_old = row.get("tafZielort_ID", "0")
        driver_old = row.get("tafFahrer_ID", "0")

        # Skip if patient missing/zero
        try:
            patient_old_int = int(patient_old)
        except (ValueError, TypeError):
            patient_old_int = 0
        if patient_old_int == 0:
            skipped_no_patient += 1
            continue

        # Skip if destination missing/zero
        try:
            dest_old_int = int(dest_old)
        except (ValueError, TypeError):
            dest_old_int = 0
        if dest_old_int == 0:
            skipped_no_dest += 1
            continue

        try:
            driver_old_int = int(driver_old)
        except (ValueError, TypeError):
            driver_old_int = 0

        if not dry_run:
            patient_uuid = patient_id_map.get(patient_old_int)
            dest_uuid = dest_id_map.get(dest_old_int)
            driver_uuid = driver_id_map.get(driver_old_int) if driver_old_int != 0 else None

            if not patient_uuid:
                skipped_no_patient += 1
                continue
            if not dest_uuid:
                skipped_no_dest += 1
                continue
        else:
            patient_uuid = f"patient-{patient_old_int}"
            dest_uuid = f"dest-{dest_old_int}"
            driver_uuid = f"driver-{driver_old_int}" if driver_old_int != 0 else None

        ride_date = parse_csv_date(row.get("tafAuftragsDatum"))
        if not ride_date:
            skipped_no_date += 1
            continue

        pickup_time = parse_csv_time(row.get("tafAbholZeit")) or "00:00:00"
        appointment_time = parse_csv_time(row.get("tafTerminZeit"))

        # DB constraint: pickup_time must be < appointment_time
        if appointment_time and pickup_time >= appointment_time:
            appointment_time = None

        price_raw = row.get("tafAuftragsPreis", "0")
        try:
            price_val = float(price_raw)
        except (ValueError, TypeError):
            price_val = 0.0
        price_override = price_val if price_val > 0 else None

        status = map_status(row.get("tafStatus"), ride_date)

        notes = build_ride_notes(
            hinweise=row.get("tafHinweise"),
            spezielles=row.get("tafSpezielles"),
            einsatzzeit=row.get("tafEinsatzzeit"),
            mehrkosten=row.get("tafMehrkosten"),
            auftragstyp=row.get("tafAuftragsTyp"),
        )

        anz_fahrten = row.get("tafAnzFahrten", "1")

        outbound_record = {
            "patient_id": patient_uuid,
            "destination_id": dest_uuid,
            "driver_id": driver_uuid,
            "date": ride_date,
            "pickup_time": pickup_time,
            "appointment_time": appointment_time,
            "status": status,
            "direction": "outbound",
            "notes": notes,
            "price_override": price_override,
            "price_override_reason": "Import Altsystem" if price_override else None,
            "is_active": True,
        }
        outbound_idx = len(outbound_records)
        outbound_records.append(outbound_record)

        # Create return ride if AnzFahrten == 2
        if anz_fahrten == "2":
            return_pickup = parse_csv_time(row.get("tafEndeZeit"))

            # Build return notes
            return_notes_parts: list[str] = ["Rückfahrt"]
            hinweise = safe_str(row.get("tafHinweise"))
            if hinweise:
                return_notes_parts.append(hinweise)
            return_notes = " | ".join(return_notes_parts)

            return_record = {
                "patient_id": patient_uuid,
                "destination_id": dest_uuid,
                "driver_id": driver_uuid,
                "date": ride_date,
                "pickup_time": return_pickup or "00:00:00",
                "appointment_time": None,
                "status": status,
                "direction": "return",
                "notes": return_notes,
                "price_override": None,
                "price_override_reason": None,
                "is_active": True,
                # parent_ride_id will be set after outbound insert
            }
            return_records.append(return_record)
            return_parent_indices.append(outbound_idx)

    if dry_run:
        print(f"  [DRY RUN] Would insert {len(outbound_records)} outbound rides")
        print(f"  [DRY RUN] Would insert {len(return_records)} return rides")
        print(f"  [DRY RUN] Total rides: {len(outbound_records) + len(return_records)}")
        print(f"  Skipped (no patient): {skipped_no_patient}")
        print(f"  Skipped (no dest): {skipped_no_dest}")
        print(f"  Skipped (no date): {skipped_no_date}")
    else:
        # Insert outbound rides in batches, collecting UUIDs
        outbound_uuids: list[str] = [""] * len(outbound_records)
        outbound_count = 0
        for i in range(0, len(outbound_records), BATCH_SIZE):
            batch = outbound_records[i : i + BATCH_SIZE]
            result = supabase.table("rides").insert(batch).execute()
            for j, data_row in enumerate(result.data):
                outbound_uuids[i + j] = data_row["id"]
            outbound_count += len(result.data)
        print(f"  Inserted: {outbound_count} outbound rides")

        # Set parent_ride_id on return records and insert
        for k, return_rec in enumerate(return_records):
            parent_idx = return_parent_indices[k]
            return_rec["parent_ride_id"] = outbound_uuids[parent_idx]

        if return_records:
            return_count = batch_insert(supabase, "rides", return_records)
            print(f"  Inserted: {return_count} return rides")
        else:
            print("  No return rides")
            return_count = 0

        print(f"  Total rides: {outbound_count + return_count}")
        print(f"  Skipped (no patient): {skipped_no_patient}")
        print(f"  Skipped (no dest): {skipped_no_dest}")
        print(f"  Skipped (no date): {skipped_no_date}")

    # -------------------------------------------------------------------
    # Summary
    # -------------------------------------------------------------------
    print("\n=== IMPORT COMPLETE ===")
    if dry_run:
        print(f"  Patients:       {len(patient_records)}")
        print(f"  Impairments:    {len(impairment_records)}")
        print(f"  Destinations:   {len(dest_records)}")
        print(f"  Drivers:        {len(driver_records)}")
        print(f"  Outbound rides: {len(outbound_records)}")
        print(f"  Return rides:   {len(return_records)}")
        print(f"  Total rides:    {len(outbound_records) + len(return_records)}")
        print("\n  [DRY RUN] No data was written.")
    else:
        print(f"  Patients:       {len(patient_id_map)}")
        print(f"  Impairments:    {len(impairment_records)}")
        print(f"  Destinations:   {len(dest_id_map)}")
        print(f"  Drivers:        {len(driver_id_map)}")
        print(f"  Outbound rides: {outbound_count}")
        print(f"  Return rides:   {return_count}")
        print(f"  Total rides:    {outbound_count + return_count}")


if __name__ == "__main__":
    main()
