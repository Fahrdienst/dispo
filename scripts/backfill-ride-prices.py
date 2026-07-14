#!/usr/bin/env python3
"""
One-off backfill: correct ride prices & direction for already-imported rides.

The initial Access import stored only tafAuftragsPreis in price_override and
hard-coded direction="outbound". This backfill re-derives, for every ride that
was imported from the Access system, the correct values:

  - price_override   = tafAuftragsPreis + tafMehrkosten   (surcharge is billed)
  - direction        = both (Doppelpreis) / return (Typ 2) / outbound (Typ 1)
  - surcharge_amount = tafMehrkosten                       (informational)

Matching mirrors sync-access-db.py exactly (patient/dest keys -> ride_key).
Only rides whose price_override_reason starts with "Import Altsystem" are
touched, so any manually re-priced ride is left untouched.

Usage:
    python scripts/backfill-ride-prices.py --dry-run   # preview (default-safe)
    python scripts/backfill-ride-prices.py              # apply updates
"""
from __future__ import annotations

import re
import sys
from datetime import date, datetime
from pathlib import Path

import pyodbc
import requests

ACCDB_PATH = Path(r"C:\GIT\Fahrdienst\db\Datenbank_DUEBI_be.accdb")
ENV_FILE = Path(__file__).resolve().parent.parent / ".env.local"
BATCH_SIZE = 50
DRY_RUN = "--dry-run" in sys.argv
IMPORT_REASON_PREFIX = "Import Altsystem"

SUPABASE_URL = ""
SUPABASE_KEY = ""


# --- env / supabase helpers (same as sync) --------------------------------


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


def sb_headers() -> dict[str, str]:
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }


def sb_get(table: str, params: dict | None = None) -> list[dict]:
    all_rows: list[dict] = []
    offset = 0
    limit = 1000
    while True:
        p = {"offset": str(offset), "limit": str(limit), "order": "created_at.asc"}
        if params:
            p.update(params)
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/{table}", headers=sb_headers(), params=p
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


def sb_patch(table: str, row_id: str, payload: dict, session: requests.Session) -> bool:
    resp = session.patch(
        f"{SUPABASE_URL}/rest/v1/{table}",
        headers={**sb_headers(), "Prefer": "return=minimal"},
        params={"id": f"eq.{row_id}"},
        json=payload,
    )
    if resp.status_code not in (200, 204):
        print(f"  ERROR patching {table} {row_id}: {resp.status_code} - {resp.text[:200]}")
        return False
    return True


# --- Access reader / cleaners (same logic as sync) ------------------------


def open_access_db() -> pyodbc.Connection:
    return pyodbc.connect(
        r"DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};" f"DBQ={ACCDB_PATH};"
    )


def fix_encoding(val: str) -> str:
    try:
        return val.encode("latin-1").decode("utf-8")
    except (UnicodeDecodeError, UnicodeEncodeError):
        return val


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


def parse_money(val) -> float:
    if val is None:
        return 0.0
    try:
        return float(str(val))
    except (ValueError, TypeError):
        return 0.0


def map_direction(typ, doppel) -> str:
    if is_truthy(doppel):
        return "both"
    try:
        t = int(typ)
    except (ValueError, TypeError):
        t = 1
    return "return" if t == 2 else "outbound"


def patient_key(last_name, first_name, plz) -> str:
    return f"{(last_name or '').lower().strip()}|{(first_name or '').lower().strip()}|{(plz or '').strip()}"


def dest_key(name, plz) -> str:
    return f"{(name or '').lower().strip()}|{(plz or '').strip()}"


def ride_key(ride_date, pickup, patient_id, dest_id) -> str:
    return f"{ride_date}|{pickup}|{patient_id}|{dest_id}"


# --- main -----------------------------------------------------------------


def main() -> None:
    global SUPABASE_URL, SUPABASE_KEY

    if not ENV_FILE.exists():
        print(f"ERROR: {ENV_FILE} not found")
        sys.exit(1)
    env = load_env(ENV_FILE)
    SUPABASE_URL = env.get("SUPABASE_URL") or env.get("NEXT_PUBLIC_SUPABASE_URL", "")
    SUPABASE_KEY = env.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local")
        sys.exit(1)

    print("=" * 60)
    print("  BACKFILL RIDE PRICES" + ("  [DRY RUN]" if DRY_RUN else ""))
    print("=" * 60)

    # Read Access
    print("\n--- Reading Access DB ---")
    conn = open_access_db()
    patients_raw = read_table(conn, "tabFahrgastAdressen")
    destinations_raw = read_table(conn, "tabZielAdressen")
    rides_raw = read_table(conn, "tabAuftragsliste")
    conn.close()

    # Access id -> key maps (only aktuell records, same filter as sync)
    access_patient_id_to_key: dict[int, str] = {}
    for row in patients_raw:
        if not is_truthy(row.get("tfgAktuell")):
            continue
        access_patient_id_to_key[int(row["Fahrgast_ID"])] = patient_key(
            safe_str(row.get("tfgNachname")) or "-",
            safe_str(row.get("tfgVorname")) or "-",
            safe_plz(row.get("tfgPostleitzahl")),
        )
    access_dest_id_to_key: dict[int, str] = {}
    for row in destinations_raw:
        if not is_truthy(row.get("tfzAktuell")):
            continue
        name = safe_str(row.get("tfzZiel_Name")) or safe_str(row.get("tfzZielOrt")) or "-"
        access_dest_id_to_key[int(row["tfzFahrziel_ID"])] = dest_key(
            name, safe_plz(row.get("tfzPostleitzahl"))
        )

    # Supabase key -> uuid
    print("--- Loading Supabase reference data ---")
    sb_patients = sb_get("patients", {"select": "id,first_name,last_name,postal_code"})
    sb_dests = sb_get("destinations", {"select": "id,display_name,postal_code"})
    key_to_patient = {
        patient_key(p.get("last_name"), p.get("first_name"), p.get("postal_code")): p["id"]
        for p in sb_patients
    }
    key_to_dest = {
        dest_key(d.get("display_name"), d.get("postal_code")): d["id"] for d in sb_dests
    }

    # Desired values per ride_key (first occurrence wins, mirroring the sync insert)
    desired: dict[str, dict] = {}
    for row in rides_raw:
        try:
            patient_old = int(row.get("tafFahrgast_ID", 0))
            dest_old = int(row.get("tafZielort_ID", 0))
        except (ValueError, TypeError):
            continue
        if not patient_old or not dest_old:
            continue
        p_key = access_patient_id_to_key.get(patient_old)
        d_key = access_dest_id_to_key.get(dest_old)
        if not p_key or not d_key:
            continue
        patient_uuid = key_to_patient.get(p_key)
        dest_uuid = key_to_dest.get(d_key)
        if not patient_uuid or not dest_uuid:
            continue
        ride_date = parse_date(row.get("tafAuftragsDatum"))
        if not ride_date:
            continue
        pickup_time = parse_time(row.get("tafAbholZeit")) or "00:00:00"
        rk = ride_key(ride_date, pickup_time, patient_uuid, dest_uuid)
        if rk in desired:
            continue  # first occurrence wins (same as sync)

        base = parse_money(row.get("tafAuftragsPreis"))
        surcharge = parse_money(row.get("tafMehrkosten"))
        price = base + surcharge
        reason = IMPORT_REASON_PREFIX
        if surcharge > 0:
            reason = f"{IMPORT_REASON_PREFIX} (Grundpreis {base:.2f} + Mehrkosten {surcharge:.2f})"
        desired[rk] = {
            "price_override": round(price, 2) if price > 0 else None,
            "price_override_reason": reason if price > 0 else None,
            "direction": map_direction(row.get("tafAuftragsTyp"), row.get("tafDoppelpreis")),
            "surcharge_amount": round(surcharge, 2),
        }

    # Load current Supabase rides
    print("--- Loading Supabase rides ---")
    sb_rides = sb_get(
        "rides",
        {"select": "id,date,pickup_time,patient_id,destination_id,direction,price_override,price_override_reason,surcharge_amount"},
    )
    print(f"  {len(sb_rides)} rides in Supabase, {len(desired)} distinct Access ride keys")

    # Diff
    updates: list[tuple[str, dict, dict, dict]] = []  # (id, payload, before, after)
    skipped_not_import = 0
    skipped_no_match = 0
    stat_price = stat_dir = stat_surcharge = 0

    for r in sb_rides:
        reason = r.get("price_override_reason") or ""
        if not reason.startswith(IMPORT_REASON_PREFIX):
            skipped_not_import += 1
            continue
        rk = ride_key(r.get("date"), r.get("pickup_time"), r.get("patient_id"), r.get("destination_id"))
        want = desired.get(rk)
        if not want:
            skipped_no_match += 1
            continue

        payload: dict = {}
        cur_price = float(r["price_override"]) if r.get("price_override") is not None else None
        want_price = want["price_override"]
        if (cur_price or 0) != (want_price or 0):
            payload["price_override"] = want_price
            payload["price_override_reason"] = want["price_override_reason"]
            stat_price += 1
        if r.get("direction") != want["direction"]:
            payload["direction"] = want["direction"]
            stat_dir += 1
        cur_surcharge = float(r.get("surcharge_amount") or 0)
        if abs(cur_surcharge - want["surcharge_amount"]) > 0.001:
            payload["surcharge_amount"] = want["surcharge_amount"]
            stat_surcharge += 1

        if payload:
            updates.append((r["id"], payload, r, want))

    print("\n--- Diff ---")
    print(f"  Rides needing update:        {len(updates)}")
    print(f"    - price_override changes:  {stat_price}")
    print(f"    - direction changes:       {stat_dir}")
    print(f"    - surcharge_amount changes:{stat_surcharge}")
    print(f"  Skipped (not an import):     {skipped_not_import}")
    print(f"  Skipped (no Access match):   {skipped_no_match}")

    # Show a few price-change examples
    price_examples = [u for u in updates if "price_override" in u[1]][:8]
    if price_examples:
        print("\n  Beispiele Preisänderungen (Mehrkosten):")
        for _id, payload, before, after in price_examples:
            print(
                f"    {before['date']} {before['pickup_time']}  "
                f"{before.get('price_override')} -> {payload['price_override']} CHF"
            )
    dir_counts: dict[str, int] = {}
    for _id, payload, _b, _a in updates:
        if "direction" in payload:
            dir_counts[payload["direction"]] = dir_counts.get(payload["direction"], 0) + 1
    if dir_counts:
        print(f"\n  Richtungs-Korrekturen nach Ziel: {dir_counts}")

    if DRY_RUN:
        print("\n  [DRY RUN] No data written.")
        return
    if not updates:
        print("\n  Nothing to update.")
        return

    print(f"\n--- Applying {len(updates)} updates ---")
    session = requests.Session()
    ok = 0
    for i, (row_id, payload, _b, _a) in enumerate(updates, 1):
        if sb_patch("rides", row_id, payload, session):
            ok += 1
        if i % 200 == 0:
            print(f"    {i}/{len(updates)} ...")
    print(f"\n  Updated {ok}/{len(updates)} rides.")


if __name__ == "__main__":
    main()
