#!/usr/bin/env python3
"""
Enrich Supabase data with additional fields from the Access backend DB.

Applies insights discovered during Access DB analysis:
1. Driver availability patterns (tabVfgbk_Fahrer → driver_availability)
2. Patient emergency contacts (tfgNotfalll → patients)
3. Destination pricing/distance metadata (tfzKosten, tfzDistanz → destinations.comment)

Usage:
    python3 scripts/enrich-from-accdb.py            # live enrichment
    python3 scripts/enrich-from-accdb.py --dry-run   # preview only
"""
from __future__ import annotations

import csv
import io
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

from supabase import create_client, Client

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

ACCDB_PATH = Path.home() / "Downloads" / "Datenbank_DUEBI_be.accdb"
ENV_FILE = Path(__file__).resolve().parent.parent / ".env.local"

# Our 5x5 availability grid slot start times (each slot = 2 hours)
SLOT_STARTS = ["08:00", "10:00", "12:00", "14:00", "16:00"]

# Access day value → which slots to create
# 0 = nicht verfügbar → no slots
# 1 = verfügbar (allgemein) → all 5 slots
# 2 = Vormittag → 08:00, 10:00
# 3 = Nachmittag → 12:00, 14:00, 16:00
# 4 = Ganzer Tag → all 5 slots
DAY_VALUE_TO_SLOTS: dict[str, list[str]] = {
    "0": [],
    "1": ["08:00", "10:00", "12:00", "14:00", "16:00"],
    "2": ["08:00", "10:00"],
    "3": ["12:00", "14:00", "16:00"],
    "4": ["08:00", "10:00", "12:00", "14:00", "16:00"],
}

ACCESS_DAY_COLS = {
    "vbMontag": "monday",
    "vbDienstag": "tuesday",
    "vbMittwoch": "wednesday",
    "vbDonnerstag": "thursday",
    "vbFreitag": "friday",
}

BATCH_SIZE = 500


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            key, _, value = line.partition("=")
            env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def mdb_export(table: str) -> list[dict]:
    result = subprocess.run(
        ["mdb-export", str(ACCDB_PATH), table],
        capture_output=True, text=True, check=True,
    )
    reader = csv.DictReader(io.StringIO(result.stdout))
    return list(reader)


def slot_end_time(start: str) -> str:
    """Compute end time: start + 2 hours."""
    hour = int(start.split(":")[0])
    return f"{hour + 2:02d}:00"


# ---------------------------------------------------------------------------
# 1. Driver Availability
# ---------------------------------------------------------------------------


def enrich_driver_availability(supabase: Client, dry_run: bool) -> None:
    print("\n--- 1. Fahrer-Verfügbarkeit ---")

    # Read Access data
    avail_rows = mdb_export("tabVfgbk_Fahrer")
    driver_rows = mdb_export("tabFahrer")

    # Build Access driver name map: access_id → (first_name, last_name)
    access_drivers: dict[str, tuple[str, str]] = {}
    for r in driver_rows:
        aid = r["tfaFahrerID"]
        first = (r.get("tfaVorname") or "").strip()
        last = (r.get("tfaNachname") or "").strip()
        access_drivers[aid] = (first, last)

    # Query Supabase drivers to build name → UUID map
    result = supabase.table("drivers").select("id, first_name, last_name").execute()
    name_to_uuid: dict[tuple[str, str], str] = {}
    for d in result.data:
        key = (d["first_name"], d["last_name"])
        name_to_uuid[key] = d["id"]

    # Derive recurring pattern per driver from confirmed weeks
    confirmed = [r for r in avail_rows if r.get("vbBestätigt") == "1"]
    if not confirmed:
        confirmed = avail_rows  # fallback to all weeks

    # Group by driver
    driver_ids = set(r["vbFahrer_ID"] for r in confirmed)

    availability_records: list[dict] = []
    matched_count = 0
    unmatched: list[str] = []

    for access_id in sorted(driver_ids, key=int):
        driver_name = access_drivers.get(access_id, ("?", "?"))
        uuid = name_to_uuid.get(driver_name)
        if not uuid:
            unmatched.append(f"{driver_name[0]} {driver_name[1]} (ID {access_id})")
            continue

        matched_count += 1
        driver_confirmed = [r for r in confirmed if r["vbFahrer_ID"] == access_id]

        for access_col, our_day in ACCESS_DAY_COLS.items():
            # Find most common day value for this driver + weekday
            values = [r.get(access_col, "0") for r in driver_confirmed]
            most_common_val = Counter(values).most_common(1)[0][0]

            slots = DAY_VALUE_TO_SLOTS.get(most_common_val, [])
            for start_time in slots:
                availability_records.append({
                    "driver_id": uuid,
                    "day_of_week": our_day,
                    "start_time": start_time,
                    "end_time": slot_end_time(start_time),
                })

    print(f"  Matched drivers: {matched_count}")
    if unmatched:
        print(f"  Unmatched: {', '.join(unmatched)}")
    print(f"  Availability slots to insert: {len(availability_records)}")

    # Show pattern summary
    if availability_records:
        by_driver: dict[str, int] = {}
        for rec in availability_records:
            by_driver[rec["driver_id"]] = by_driver.get(rec["driver_id"], 0) + 1
        uuid_to_name = {v: f"{k[0]} {k[1]}" for k, v in name_to_uuid.items()}
        for uid, cnt in sorted(by_driver.items(), key=lambda x: -x[1]):
            name = uuid_to_name.get(uid, uid[:8])
            print(f"    {name}: {cnt} slots")

    if dry_run:
        print("  [DRY RUN] Would delete existing + insert above")
    else:
        # Delete all existing weekly availability
        supabase.table("driver_availability") \
            .delete() \
            .neq("id", "00000000-0000-0000-0000-000000000000") \
            .execute()
        print("  Cleared existing availability")

        # Insert new
        if availability_records:
            total = 0
            for i in range(0, len(availability_records), BATCH_SIZE):
                batch = availability_records[i:i + BATCH_SIZE]
                res = supabase.table("driver_availability").insert(batch).execute()
                total += len(res.data)
            print(f"  Inserted: {total} availability slots")


# ---------------------------------------------------------------------------
# 2. Patient Emergency Contacts
# ---------------------------------------------------------------------------


def enrich_patient_emergency_contacts(supabase: Client, dry_run: bool) -> None:
    print("\n--- 2. Patienten-Notfallkontakte ---")

    patients_raw = mdb_export("tabFahrgastAdressen")

    # Find patients with Notfall data
    notfall_entries: list[tuple[str, str, str, str]] = []  # (first, last, contact_name, contact_phone)
    for r in patients_raw:
        nf = (r.get("tfgNotfalll") or "").strip()
        if not nf:
            continue
        first = (r.get("tfgVorname") or "").strip()
        last = (r.get("tfgNachname") or "").strip()

        # Parse emergency contact: try to extract name and phone
        # Examples:
        #   "Frau Büsch jun. 077 941 24 57"
        #   "Thomas Laubscher 076 443 61 77, Sohn"
        #   "Frau  Brecht"
        #   "+41448028300"

        # Try to split by phone pattern
        phone_match = re.search(r'(\+?\d[\d\s]{8,})', nf)
        if phone_match:
            phone = phone_match.group(1).strip()
            name_part = nf[:phone_match.start()].strip().rstrip(",").strip()
            # Remove trailing relationship info after phone
            remainder = nf[phone_match.end():].strip().strip(",").strip()
            if remainder and not remainder[0].isdigit():
                name_part = f"{name_part} ({remainder})" if name_part else remainder
            if not name_part:
                name_part = "Notfallkontakt"
            notfall_entries.append((first, last, name_part, phone))
        else:
            # No phone found, put all in name
            notfall_entries.append((first, last, nf, ""))

    print(f"  Notfallkontakte gefunden: {len(notfall_entries)}")
    for first, last, contact_name, contact_phone in notfall_entries:
        print(f"    {first} {last} → {contact_name} / {contact_phone}")

    if dry_run:
        print("  [DRY RUN] Would update patients above")
        return

    # Query Supabase patients by name
    updated = 0
    for first, last, contact_name, contact_phone in notfall_entries:
        result = supabase.table("patients") \
            .select("id") \
            .eq("first_name", first) \
            .eq("last_name", last) \
            .execute()
        if result.data:
            pid = result.data[0]["id"]
            update_data: dict = {"emergency_contact_name": contact_name}
            if contact_phone:
                update_data["emergency_contact_phone"] = contact_phone
            supabase.table("patients").update(update_data).eq("id", pid).execute()
            updated += 1
            print(f"    Updated: {first} {last}")
        else:
            print(f"    NOT FOUND: {first} {last}")

    print(f"  Updated: {updated} patients")


# ---------------------------------------------------------------------------
# 3. Destination Pricing & Distance
# ---------------------------------------------------------------------------


def enrich_destination_metadata(supabase: Client, dry_run: bool) -> None:
    print("\n--- 3. Ziel-Preise & Distanzen ---")

    dests_raw = mdb_export("tabZielAdressen")

    # Build enrichment data: name → (kosten, kosten2, distanz, anfahrzeit_min)
    from datetime import datetime

    enrichment: list[dict] = []
    for r in dests_raw:
        name = (r.get("tfzZiel_Name") or r.get("tfzZielOrt") or "").strip()
        if not name:
            continue

        try:
            kosten = float(r.get("tfzKosten", "0") or 0)
        except ValueError:
            kosten = 0.0
        try:
            kosten2 = float(r.get("tfzKosten2", "0") or 0)
        except ValueError:
            kosten2 = 0.0

        dist_str = (r.get("tfzDistanz (km)", "") or "").strip()
        try:
            distanz = int(float(dist_str)) if dist_str else 0
        except ValueError:
            distanz = 0

        anfahrzeit_min = 0
        az_str = (r.get("tfzAnfahrzeit", "") or "").strip()
        if az_str:
            try:
                t = datetime.strptime(az_str, "%m/%d/%y %H:%M:%S")
                anfahrzeit_min = t.hour * 60 + t.minute
            except ValueError:
                pass

        # Build comment addition
        parts: list[str] = []
        if kosten > 0:
            parts.append(f"Einfach: {kosten:.0f} CHF")
        if kosten2 > 0:
            parts.append(f"Hin+Rück: {kosten2:.0f} CHF")
        if distanz > 0:
            parts.append(f"Distanz: {distanz} km")
        if anfahrzeit_min > 0:
            parts.append(f"Anfahrt: {anfahrzeit_min} min")

        if parts:
            enrichment.append({
                "display_name": name,
                "metadata": " | ".join(parts),
            })

    print(f"  Destinationen mit Preis/Distanz-Daten: {len(enrichment)}")

    if dry_run:
        for e in enrichment[:5]:
            print(f"    {e['display_name']}: {e['metadata']}")
        print(f"    ... ({len(enrichment)} total)")
        print("  [DRY RUN] Would update destination comments")
        return

    # Query all destinations from Supabase
    result = supabase.table("destinations").select("id, display_name, comment").execute()
    name_to_dest: dict[str, dict] = {}
    for d in result.data:
        name_to_dest[d["display_name"]] = d

    updated = 0
    not_found = 0
    for e in enrichment:
        dest = name_to_dest.get(e["display_name"])
        if not dest:
            not_found += 1
            continue

        # Append metadata to existing comment (don't overwrite)
        existing = (dest.get("comment") or "").strip()
        metadata = e["metadata"]

        # Skip if metadata already present
        if metadata in existing:
            continue

        new_comment = f"{existing}\n{metadata}".strip() if existing else metadata

        supabase.table("destinations").update({"comment": new_comment}).eq("id", dest["id"]).execute()
        updated += 1

    print(f"  Updated: {updated} destinations")
    if not_found:
        print(f"  Not found by name: {not_found}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    dry_run = "--dry-run" in sys.argv

    if not ENV_FILE.exists():
        print(f"ERROR: {ENV_FILE} not found")
        sys.exit(1)
    env = load_env(ENV_FILE)
    url = env.get("SUPABASE_URL") or env.get("NEXT_PUBLIC_SUPABASE_URL")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local")
        sys.exit(1)

    if not ACCDB_PATH.exists():
        print(f"ERROR: Access DB not found: {ACCDB_PATH}")
        sys.exit(1)

    supabase: Client = create_client(url, key)

    if dry_run:
        print("=== DRY RUN MODE ===\n")
    else:
        print("=== LIVE MODE ===\n")

    enrich_driver_availability(supabase, dry_run)
    enrich_patient_emergency_contacts(supabase, dry_run)
    enrich_destination_metadata(supabase, dry_run)

    print("\n=== ENRICHMENT COMPLETE ===")


if __name__ == "__main__":
    main()
