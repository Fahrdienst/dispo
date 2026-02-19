# ADR 003: Patient Profile -- Swiss Requirements

## Status

Proposed

## Date

2026-02-19

## Context

The patient data model needs to be expanded for Swiss ambulance transport requirements. Address must become mandatory with CH postal code validation, emergency contact and comment fields are needed, and the three boolean flags (`needs_wheelchair`, `needs_stretcher`, `needs_companion`) must be replaced by a structured impairment model that is easier to extend.

## Decision

### Mandatory Address Fields

- `first_name`, `last_name`: already required
- `street`, `house_number`, `postal_code`, `city`: become required in the application layer (Zod validation). Database allows NULL for existing records but enforces CH format when set.
- `postal_code`: CHECK constraint `^\d{4}$` (Swiss 4-digit postal codes)

### New Optional Fields on `patients`

| Column | Type | Constraint |
|--------|------|------------|
| `emergency_contact_name` | `text` | max 200 chars |
| `emergency_contact_phone` | `text` | max 50 chars |
| `comment` | `text` | max 2000 chars |

- `notes` remains as the internal/operational field.
- `comment` is new and intended for clinical/patient-facing notes.

### Impairment Model

Instead of boolean columns, impairments are stored in a junction table:

- **Enum** `impairment_type`: `rollator`, `wheelchair`, `stretcher`, `companion`
- **Table** `patient_impairments`: `(id, patient_id FK, impairment_type, created_at)` with a UNIQUE constraint on `(patient_id, impairment_type)`
- Updates use a **replace-all** strategy: delete all impairments for a patient, then insert the new set.

### Extensibility

New impairment types can be added via `ALTER TYPE impairment_type ADD VALUE '...'` without schema changes to the junction table.

### Data Migration

Existing boolean flags are migrated:
- `needs_wheelchair = true` --> `patient_impairments(wheelchair)`
- `needs_stretcher = true` --> `patient_impairments(stretcher)`
- `needs_companion = true` --> `patient_impairments(companion)`

After migration, the three boolean columns are dropped.

### RLS

`patient_impairments` follows the same pattern as `patients`:
- Staff (admin, operator): full CRUD
- Drivers: SELECT only for patients on their active rides
- DELETE policy is added (unlike most tables) because impairments use replace-all updates

## Consequences

- All new patients require a full Swiss address
- Existing patients with NULL address fields will show validation errors on edit until addressed
- The impairment model supports future types (e.g., oxygen, visual impairment) without schema migration
- Driver views automatically include impairment data via the junction table join
