# ADR 004: Destination Profile -- Swiss Requirements (Zieleprofil)

## Status

Proposed

## Date

2026-02-19

## Context

The destination data model needs expansion for Swiss ambulance transport
operations. The current single `name` field and basic `destination_type` enum
are insufficient. Requirements include: mandatory contact person (first name,
last name, phone), a richer facility type taxonomy (Praxis, Spital,
Therapiezentrum, Tagesheim), mandatory address with CH postal code validation,
and a free-text comment field.

## Decision

### Rename `name` to `display_name`

- `display_name` (required): The facility/destination name
  (e.g. "Universitaetsspital Zuerich")
- The rename preserves existing data via ALTER TABLE ... RENAME COLUMN

### Mandatory Contact Person

| Column               | Type   | Constraint     |
|----------------------|--------|----------------|
| `contact_first_name` | `text` | required, max 100 |
| `contact_last_name`  | `text` | required, max 100 |
| `contact_phone`      | `text` | required, max 50  |

Required in the application layer (Zod). Database allows NULL for existing
records to enable incremental backfill.

### Replace `destination_type` Enum with `facility_type`

Old values -> New values:
- `hospital` -> `hospital` (Spital)
- `doctor`   -> `practice` (Praxis)
- `therapy`  -> `therapy_center` (Therapiezentrum)
- `other`    -> `other` (Sonstiges)
- (new)      -> `day_care` (Tagesheim)

The old enum `destination_type` is dropped after data migration.

### Mandatory Address with CH Postal Code

- `street`, `house_number`, `postal_code`, `city`: required in Zod
- `postal_code`: CHECK constraint `^\d{4}$` (Swiss 4-digit)
- Database allows NULL for existing records

### Comment Field

- `comment` replaces `notes` (max 2000 chars)
- Existing `notes` values are migrated to `comment`
- `notes` column is dropped

### `department` Retained

Optional free-text field, no changes.

### RLS

No structural changes. Existing policies are column-agnostic:
- Admin/Operator: full CRUD
- Driver: SELECT only (contact_phone visible -- needed for pickups)

## Consequences

- All new destinations require contact person + full Swiss address
- Existing destinations show validation errors on edit until backfilled
- Rides integration: `name` -> `display_name` in queries and UI
- The `notes` field is removed; `comment` replaces it
- New facility types available immediately after migration
