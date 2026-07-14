#!/usr/bin/env python3
"""
Incremental sync from Access DB to Supabase.
Only imports NEW records that don't exist yet in Supabase.

Matching logic:
  - Patients: matched by last_name + first_name + postal_code
  - Destinations: matched by display_name + postal_code
  - Drivers: matched by last_name + first_name
  - Rides: matched by date + pickup_time + patient_id + destination_id

Usage:
    python scripts/sync-access-db.py --dry-run   # preview without writing
    python scripts/sync-access-db.py              # sync new records only
"""
from __future__ import annotations

import re
import sys
from datetime import date, datetime
from pathlib import Path

import pyodbc
import requests

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

ACCDB_PATH = Path(r"C:\GIT\Fahrdienst\db\Datenbank_DUEBI_be.accdb")
ENV_FILE = Path(__file__).resolve().parent.parent / ".env.local"
BATCH_SIZE = 50
DRY_RUN = "--dry-run" in sys.argv

# ---------------------------------------------------------------------------
# Env loader
# ---------------------------------------------------------------------------


def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            key, _, value = line.partition("=")
            env[key.strip()] = value.strip().strip('"').strip("'")
    return env


# ---------------------------------------------------------------------------
# Supabase REST helper
# ---------------------------------------------------------------------------

SUPABASE_URL = ""
SUPABASE_KEY = ""


def sb_headers() -> dict[str, str]:
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def sb_get(table: str, params: dict | None = None) -> list[dict]:
    """GET all rows from Supabase table (paginated)."""
    all_rows: list[dict] = []
    offset = 0
    limit = 1000
    while True:
        p = {"offset": str(offset), "limit": str(limit), "order": "created_at.asc"}
        if params:
            p.update(params)
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/{table}",
            headers=sb_headers(),
            params=p,
        )
        if resp.status_code != 200:
            print(f"  ERROR reading {table}: {resp.status_code} - {resp.text[:300]}")
            return all_rows
        batch = resp.json()
        all_rows.extend(batch)
        if len(batch) < limit:
            break
        offset += limit
    return all_rows


def sb_insert(table: str, rows: list[dict]) -> list[dict]:
    """Insert rows in batches, return inserted rows."""
    all_data: list[dict] = []
    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i : i + BATCH_SIZE]
        resp = requests.post(
            f"{SUPABASE_URL}/rest/v1/{table}",
            headers=sb_headers(),
            json=batch,
        )
        if resp.status_code not in (200, 201):
            print(f"  ERROR inserting into {table}: {resp.status_code}")
            print(f"  Response: {resp.text[:500]}")
            return all_data
        all_data.extend(resp.json())
    return all_data


# ---------------------------------------------------------------------------
# Access DB reader
# ---------------------------------------------------------------------------


def open_access_db() -> pyodbc.Connection:
    return pyodbc.connect(
        r"DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};"
        f"DBQ={ACCDB_PATH};"
    )


def read_table(conn: pyodbc.Connection, table: str) -> list[dict]:
    cursor = conn.cursor()
    cursor.execute(f"SELECT * FROM [{table}]")
    columns = [col[0] for col in cursor.description]
    rows: list[dict] = []
    for row in cursor.fetchall():
        d: dict = {}
        for idx, col in enumerate(columns):
            val = row[idx]
            if isinstance(val, str):
                val = fix_encoding(val)
            d[col] = val
        rows.append(d)
    return rows


# ---------------------------------------------------------------------------
# Data cleaning helpers (same as import script)
# ---------------------------------------------------------------------------


def fix_encoding(val: str) -> str:
    try:
        return val.encode("latin-1").decode("utf-8")
    except (UnicodeDecodeError, UnicodeEncodeError):
        return val


def safe_str(val) -> str | None:
    if val is None:
        return None
    s = str(val).strip()
    return s if s else None


def safe_plz(val) -> str | None:
    if val is None:
        return None
    s = str(val).strip()
    if not s:
        return None
    try:
        s = str(int(float(s)))
    except ValueError:
        pass
    return s.zfill(4) if s else None


def clean_email(val) -> str | None:
    if val is None:
        return None
    s = str(val).strip()
    if not s:
        return None
    if "#" in s:
        s = s.split("#")[0]
    s = s.strip().lower()
    if "@" not in s or "." not in s:
        return None
    return s if s else None


def format_phone(val) -> str | None:
    if val is None:
        return None
    s = str(val).strip().replace("\x00", "").strip()
    return s if s else None


def pick_phone(row: dict, telefon_key: str, mobile_key: str) -> str | None:
    return format_phone(row.get(telefon_key)) or format_phone(row.get(mobile_key))


def split_address(addr: str | None) -> tuple[str | None, str | None]:
    if not addr:
        return None, None
    addr = addr.strip()
    m = re.match(r"^(.+?)\s+(\d+\S*)$", addr)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return addr, None


def parse_date(val) -> str | None:
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.strftime("%Y-%m-%d")
    if isinstance(val, date):
        return val.isoformat()
    s = str(val).strip()
    if not s:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%m/%d/%Y %H:%M:%S", "%d.%m.%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def parse_time(val) -> str | None:
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.strftime("%H:%M:%S")
    s = str(val).strip()
    if not s:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%H:%M:%S", "%H:%M", "%m/%d/%Y %H:%M:%S"):
        try:
            return datetime.strptime(s, fmt).strftime("%H:%M:%S")
        except ValueError:
            continue
    return None


def is_truthy(val) -> bool:
    if val is None:
        return False
    if isinstance(val, bool):
        return val
    try:
        return int(val) != 0
    except (ValueError, TypeError):
        return str(val).strip().lower() in ("true", "ja", "yes", "-1", "1")


def map_facility_type(art: str | None) -> str:
    if not art:
        return "other"
    a = art.lower().strip()
    if any(w in a for w in ("spital", "klinik", "hospital", "privatklinik")):
        return "hospital"
    if any(w in a for w in ("physio", "ergo", "therapie", "rehab", "logopäd")):
        return "therapy_center"
    if any(w in a for w in ("arzt", "praxis", "hausarzt", "zahnarzt")):
        return "practice"
    if any(w in a for w in ("tagesheim", "tageszentrum", "altersheim", "pflegeheim")):
        return "day_care"
    return "other"


def parse_impairments(behinderung: str | None) -> list[str]:
    if not behinderung:
        return []
    b = behinderung.lower()
    impairments: list[str] = []
    if "rollator" in b:
        impairments.append("rollator")
    if "rollstuhl" in b:
        impairments.append("wheelchair")
    if any(w in b for w in ("bahre", "trage", "liegend")):
        impairments.append("stretcher")
    if any(w in b for w in ("begleit", "dement", "demenz")):
        impairments.append("companion")
    return impairments


def map_status(val, ride_date: str | None = None) -> str:
    try:
        code = int(val)
    except (ValueError, TypeError):
        return "unplanned"
    if code == 5:
        today = date.today().isoformat()
        if ride_date and ride_date >= today:
            return "confirmed"
        return "completed"
    return {1: "unplanned", 2: "unplanned", 3: "planned", 4: "planned", 6: "cancelled"}.get(code, "unplanned")


def parse_money(val) -> float:
    """Parse an Access currency/number field to float, 0.0 on failure."""
    if val is None:
        return 0.0
    try:
        return float(str(val))
    except (ValueError, TypeError):
        return 0.0


def map_direction(typ, doppel) -> str:
    """Map Access order type + Doppelpreis flag to ride_direction.

    Doppelpreis=True means a round trip (Hin+Rueckfahrt) captured on one row,
    where tafAuftragsPreis already holds the full doubled amount. Otherwise
    tafAuftragsTyp distinguishes 1=Hinfahrt (outbound) / 2=Rueckfahrt (return).
    """
    if is_truthy(doppel):
        return "both"
    try:
        t = int(typ)
    except (ValueError, TypeError):
        t = 1
    return "return" if t == 2 else "outbound"


# ---------------------------------------------------------------------------
# Matching keys
# ---------------------------------------------------------------------------


def patient_key(last_name: str | None, first_name: str | None, plz: str | None) -> str:
    return f"{(last_name or '').lower().strip()}|{(first_name or '').lower().strip()}|{(plz or '').strip()}"


def dest_key(name: str | None, plz: str | None) -> str:
    return f"{(name or '').lower().strip()}|{(plz or '').strip()}"


def driver_key(last_name: str | None, first_name: str | None) -> str:
    return f"{(last_name or '').lower().strip()}|{(first_name or '').lower().strip()}"


def ride_key(ride_date: str | None, pickup: str | None, patient_id: str | None, dest_id: str | None) -> str:
    return f"{ride_date}|{pickup}|{patient_id}|{dest_id}"


# ---------------------------------------------------------------------------
# Main sync
# ---------------------------------------------------------------------------


def main() -> None:
    global SUPABASE_URL, SUPABASE_KEY

    # Load env
    if not ENV_FILE.exists():
        print(f"ERROR: {ENV_FILE} not found")
        sys.exit(1)
    env = load_env(ENV_FILE)
    SUPABASE_URL = env.get("SUPABASE_URL") or env.get("NEXT_PUBLIC_SUPABASE_URL", "")
    SUPABASE_KEY = env.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local")
        sys.exit(1)

    if DRY_RUN:
        print("=" * 60)
        print("  DRY RUN — no data will be written")
        print("=" * 60)
    else:
        print("=" * 60)
        print("  INCREMENTAL SYNC — only new records")
        print("=" * 60)

    # ------------------------------------------------------------------
    # Phase 0: Read Access DB
    # ------------------------------------------------------------------
    print("\n--- Phase 0: Reading Access DB ---")
    conn = open_access_db()
    patients_raw = read_table(conn, "tabFahrgastAdressen")
    destinations_raw = read_table(conn, "tabZielAdressen")
    drivers_raw = read_table(conn, "tabFahrer")
    rides_raw = read_table(conn, "tabAuftragsliste")
    conn.close()
    print(f"  Access: {len(patients_raw)} patients, {len(destinations_raw)} destinations, {len(drivers_raw)} drivers, {len(rides_raw)} rides")

    # ------------------------------------------------------------------
    # Phase 1: Load existing Supabase data for matching
    # ------------------------------------------------------------------
    print("\n--- Phase 1: Loading existing Supabase data ---")
    sb_patients = sb_get("patients", {"select": "id,first_name,last_name,postal_code"})
    sb_destinations = sb_get("destinations", {"select": "id,display_name,postal_code"})
    sb_drivers = sb_get("drivers", {"select": "id,first_name,last_name"})
    sb_rides = sb_get("rides", {"select": "id,date,pickup_time,patient_id,destination_id"})
    print(f"  Supabase: {len(sb_patients)} patients, {len(sb_destinations)} destinations, {len(sb_drivers)} drivers, {len(sb_rides)} rides")

    # Build lookup sets
    existing_patients = {}
    for p in sb_patients:
        k = patient_key(p.get("last_name"), p.get("first_name"), p.get("postal_code"))
        existing_patients[k] = p["id"]

    existing_dests = {}
    for d in sb_destinations:
        k = dest_key(d.get("display_name"), d.get("postal_code"))
        existing_dests[k] = d["id"]

    existing_drivers = {}
    for d in sb_drivers:
        k = driver_key(d.get("last_name"), d.get("first_name"))
        existing_drivers[k] = d["id"]

    existing_rides = set()
    for r in sb_rides:
        k = ride_key(r.get("date"), r.get("pickup_time"), r.get("patient_id"), r.get("destination_id"))
        existing_rides.add(k)

    # ------------------------------------------------------------------
    # Phase 2: Sync Patients
    # ------------------------------------------------------------------
    print("\n--- Phase 2a: Sync Patienten ---")
    new_patients: list[dict] = []
    access_patient_id_to_key: dict[int, str] = {}

    for row in patients_raw:
        if not is_truthy(row.get("tfgAktuell")):
            continue
        old_id = int(row["Fahrgast_ID"])
        last = safe_str(row.get("tfgNachname")) or "-"
        first = safe_str(row.get("tfgVorname")) or "-"
        plz = safe_plz(row.get("tfgPostleitzahl"))
        k = patient_key(last, first, plz)
        access_patient_id_to_key[old_id] = k

        if k in existing_patients:
            continue  # Already exists

        street, house_number = split_address(safe_str(row.get("tfgAbholAdresse")))
        behinderung_text = safe_str(row.get("tfgBehinderung"))
        bemerkungen = safe_str(row.get("tfgBemerkungen"))
        notes_parts: list[str] = []
        if bemerkungen:
            notes_parts.append(bemerkungen)
        if behinderung_text:
            notes_parts.append(f"Behinderung: {behinderung_text}")

        new_patients.append({
            "first_name": first,
            "last_name": last,
            "street": street,
            "house_number": house_number,
            "postal_code": plz,
            "city": safe_str(row.get("tfgAbholOrt")),
            "phone": pick_phone(row, "tfgTelefon", "tfgMobile"),
            "notes": "\n".join(notes_parts) if notes_parts else None,
            "is_active": True,
            "_access_id": old_id,  # temp, removed before insert
            "_key": k,
        })

    if DRY_RUN:
        print(f"  Would insert {len(new_patients)} new patients (skipped {len(access_patient_id_to_key) - len(new_patients)} existing)")
    elif new_patients:
        to_insert = [{k: v for k, v in p.items() if not k.startswith("_")} for p in new_patients]
        inserted = sb_insert("patients", to_insert)
        for j, data_row in enumerate(inserted):
            k = new_patients[j]["_key"]
            existing_patients[k] = data_row["id"]
        print(f"  Inserted: {len(inserted)} new patients")
    else:
        print("  No new patients")

    # ------------------------------------------------------------------
    # Phase 2b: Sync Destinations
    # ------------------------------------------------------------------
    print("\n--- Phase 2b: Sync Zieladressen ---")
    new_dests: list[dict] = []
    access_dest_id_to_key: dict[int, str] = {}

    for row in destinations_raw:
        if not is_truthy(row.get("tfzAktuell")):
            continue
        old_id = int(row["tfzFahrziel_ID"])
        name = safe_str(row.get("tfzZiel_Name")) or safe_str(row.get("tfzZielOrt")) or "-"
        plz = safe_plz(row.get("tfzPostleitzahl"))
        k = dest_key(name, plz)
        access_dest_id_to_key[old_id] = k

        if k in existing_dests:
            continue

        street, house_number = split_address(safe_str(row.get("tfzZielAdresse")))
        new_dests.append({
            "display_name": name,
            "facility_type": map_facility_type(safe_str(row.get("tfzZiel_Art"))),
            "street": street,
            "house_number": house_number,
            "postal_code": plz,
            "city": safe_str(row.get("tfzZielOrt")),
            "contact_phone": format_phone(row.get("tfzTelefon")),
            "is_active": True,
            "_key": k,
        })

    if DRY_RUN:
        print(f"  Would insert {len(new_dests)} new destinations (skipped {len(access_dest_id_to_key) - len(new_dests)} existing)")
    elif new_dests:
        to_insert = [{k: v for k, v in d.items() if not k.startswith("_")} for d in new_dests]
        inserted = sb_insert("destinations", to_insert)
        for j, data_row in enumerate(inserted):
            k = new_dests[j]["_key"]
            existing_dests[k] = data_row["id"]
        print(f"  Inserted: {len(inserted)} new destinations")
    else:
        print("  No new destinations")

    # ------------------------------------------------------------------
    # Phase 2c: Sync Drivers
    # ------------------------------------------------------------------
    print("\n--- Phase 2c: Sync Fahrer ---")
    new_drivers: list[dict] = []
    access_driver_id_to_key: dict[int, str] = {}

    for row in drivers_raw:
        if not is_truthy(row.get("tfaAktiv")):
            continue
        old_id = int(row["tfaFahrerID"])
        last = safe_str(row.get("tfaNachname")) or "-"
        first = safe_str(row.get("tfaVorname")) or "-"
        k = driver_key(last, first)
        access_driver_id_to_key[old_id] = k

        if k in existing_drivers:
            continue

        street, house_number = split_address(safe_str(row.get("tfaAdresse")))
        notes_parts: list[str] = []
        fahrzeug = safe_str(row.get("tfaFahrzeug"))
        if fahrzeug:
            notes_parts.append(f"Fahrzeug: {fahrzeug}")
        eigenschaften = safe_str(row.get("tfaEigenschaften"))
        if eigenschaften:
            notes_parts.append(eigenschaften)

        new_drivers.append({
            "first_name": first,
            "last_name": last,
            "street": street,
            "house_number": house_number,
            "postal_code": safe_plz(row.get("tfaPostleitzahl")),
            "city": safe_str(row.get("tfaWohnort")),
            "phone": pick_phone(row, "tfaTelefon", "tfaMobile"),
            "email": clean_email(row.get("tfaEmail")),
            "vehicle_type": "standard",
            "notes": "\n".join(notes_parts) if notes_parts else None,
            "is_active": True,
            "_key": k,
        })

    if DRY_RUN:
        print(f"  Would insert {len(new_drivers)} new drivers (skipped {len(access_driver_id_to_key) - len(new_drivers)} existing)")
    elif new_drivers:
        to_insert = [{k: v for k, v in d.items() if not k.startswith("_")} for d in new_drivers]
        inserted = sb_insert("drivers", to_insert)
        for j, data_row in enumerate(inserted):
            k = new_drivers[j]["_key"]
            existing_drivers[k] = data_row["id"]
        print(f"  Inserted: {len(inserted)} new drivers")
    else:
        print("  No new drivers")

    # ------------------------------------------------------------------
    # Phase 3: Sync Rides
    # ------------------------------------------------------------------
    print("\n--- Phase 3: Sync Fahrten ---")
    new_rides: list[dict] = []
    skipped_existing = 0
    skipped_no_match = 0

    for row in rides_raw:
        try:
            patient_old = int(row.get("tafFahrgast_ID", 0))
        except (ValueError, TypeError):
            patient_old = 0
        try:
            dest_old = int(row.get("tafZielort_ID", 0))
        except (ValueError, TypeError):
            dest_old = 0
        try:
            driver_old = int(row.get("tafFahrer_ID", 0))
        except (ValueError, TypeError):
            driver_old = 0

        if patient_old == 0 or dest_old == 0:
            skipped_no_match += 1
            continue

        # Resolve UUIDs via keys
        p_key = access_patient_id_to_key.get(patient_old)
        d_key = access_dest_id_to_key.get(dest_old)
        if not p_key or not d_key:
            skipped_no_match += 1
            continue

        patient_uuid = existing_patients.get(p_key)
        dest_uuid = existing_dests.get(d_key)
        if not patient_uuid or not dest_uuid:
            skipped_no_match += 1
            continue

        dr_key = access_driver_id_to_key.get(driver_old) if driver_old else None
        driver_uuid = existing_drivers.get(dr_key) if dr_key else None

        ride_date = parse_date(row.get("tafAuftragsDatum"))
        if not ride_date:
            skipped_no_match += 1
            continue

        pickup_time = parse_time(row.get("tafAbholZeit")) or "00:00:00"

        # Check if ride already exists
        rk = ride_key(ride_date, pickup_time, patient_uuid, dest_uuid)
        if rk in existing_rides:
            skipped_existing += 1
            continue

        appointment_time = parse_time(row.get("tafTerminZeit"))
        if appointment_time and pickup_time >= appointment_time:
            appointment_time = None

        # Billed price = base fare + surcharge. The app's effective price is
        # `price_override ?? calculated_price` and never adds surcharge_amount,
        # so tafMehrkosten must be folded into price_override to be invoiced.
        base_price = parse_money(row.get("tafAuftragsPreis"))
        surcharge = parse_money(row.get("tafMehrkosten"))
        price_val = base_price + surcharge

        direction = map_direction(row.get("tafAuftragsTyp"), row.get("tafDoppelpreis"))

        reason = "Import Altsystem"
        if surcharge > 0:
            reason = f"Import Altsystem (Grundpreis {base_price:.2f} + Mehrkosten {surcharge:.2f})"

        status = map_status(row.get("tafStatus"), ride_date)

        new_rides.append({
            "patient_id": patient_uuid,
            "destination_id": dest_uuid,
            "driver_id": driver_uuid,
            "date": ride_date,
            "pickup_time": pickup_time,
            "appointment_time": appointment_time,
            "status": status,
            "direction": direction,
            "price_override": price_val if price_val > 0 else None,
            "price_override_reason": reason if price_val > 0 else None,
            # Informational only (not added to the billed total by the app):
            "surcharge_amount": surcharge,
            "is_active": True,
        })
        existing_rides.add(rk)  # Prevent duplicates within this run

    if DRY_RUN:
        print(f"  Would insert {len(new_rides)} new rides")
        print(f"  Skipped (already exist): {skipped_existing}")
        print(f"  Skipped (no match):      {skipped_no_match}")
    elif new_rides:
        inserted = sb_insert("rides", new_rides)
        print(f"  Inserted: {len(inserted)} new rides")
        print(f"  Skipped (already exist): {skipped_existing}")
        print(f"  Skipped (no match):      {skipped_no_match}")
    else:
        print(f"  No new rides to sync")
        print(f"  Skipped (already exist): {skipped_existing}")
        print(f"  Skipped (no match):      {skipped_no_match}")

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------
    print("\n" + "=" * 60)
    print("  SYNC COMPLETE")
    print("=" * 60)
    print(f"  New patients:     {len(new_patients)}")
    print(f"  New destinations: {len(new_dests)}")
    print(f"  New drivers:      {len(new_drivers)}")
    print(f"  New rides:        {len(new_rides)}")
    if DRY_RUN:
        print("\n  [DRY RUN] No data was written.")


if __name__ == "__main__":
    main()
