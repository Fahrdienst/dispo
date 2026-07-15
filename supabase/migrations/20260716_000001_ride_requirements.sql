-- M13: Fahrt-Erfassung -- Ride requirements on ride level (Issue #126)
--
-- Goal: capture the transport requirements of a single ride (wheelchair,
-- rollator, companion, oxygen, carry chair, stretcher) as an input for the
-- later vehicle selection. This is a pure schema/helper change; the capture UI
-- follows in #135.
--
-- Decisions (Issue #126):
--   * NEW `ride_requirement` enum -- deliberately NOT reusing `impairment_type`
--     (patient level, no oxygen). The new enum is a superset of impairment_type
--     plus `oxygen` and `carry_chair`.
--   * NO `vehicle_type` enum extension in M13. `vehicle_type` stays lean;
--     `oxygen`/`carry_chair` remain purely informative requirement flags that do
--     NOT introduce new vehicle types. Mapping lives in
--     `src/lib/rides/requirements.ts` (requirementsToVehicleType).
--   * `rides.has_escort` (tariff-relevant boolean) stays as-is. The `companion`
--     requirement mirrors the same real-world fact; the two are intentionally
--     NOT force-synced here to avoid double-bookkeeping. Any mirroring is an
--     application-level concern to be decided in the capture UI (#135).

-- =============================================================
-- 1: Enum type
-- =============================================================

-- Superset of `impairment_type` (rollator/wheelchair/stretcher/companion)
-- extended with `oxygen` and `carry_chair`.
CREATE TYPE public.ride_requirement AS ENUM (
  'wheelchair',
  'rollator',
  'companion',
  'oxygen',
  'carry_chair',
  'stretcher'
);

-- =============================================================
-- 2: Column
-- =============================================================

-- Set-valued requirements per ride. NOT NULL with an empty-array default so
-- existing rows and inserts without requirements are well-defined (no NULLs).
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS requirements public.ride_requirement[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.rides.requirements IS
  'Transport requirements for this ride (Issue #126). Input for vehicle '
  'selection via requirementsToVehicleType(). oxygen/carry_chair are '
  'informative flags and do NOT map to a vehicle_type.';

-- No RLS changes required: `requirements` is an additional column on the
-- existing `rides` table and is covered by the table's existing policies.
