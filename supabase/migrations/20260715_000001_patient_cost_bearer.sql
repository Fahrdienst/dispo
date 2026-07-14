-- Migration: Kostenträger (cost bearer) on the patient
-- Issue #125 (part of #124), design decision #11.
--
-- Cost bearer is tracked ONLY on the patient, never on the ride. This is a pure
-- schema change; capture/editing happens through the existing patient forms
-- (#137 / #134).
--
-- Idempotent: safe to re-run.

-- -----------------------------------------------------------------------------
-- 1. Enum type
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'cost_bearer_type'
  ) then
    create type public.cost_bearer_type as enum (
      'health_insurance',
      'self_payer',
      'municipality',
      'other'
    );
  end if;
end$$;

-- -----------------------------------------------------------------------------
-- 2. Column on patients
-- -----------------------------------------------------------------------------
-- Nullable, NO default: existing rows stay NULL so the M8 billing logic is not
-- affected (there is no cost-bearer-driven pricing today).
alter table public.patients
  add column if not exists cost_bearer public.cost_bearer_type;

comment on column public.patients.cost_bearer is
  'Kostenträger for this patient (health_insurance | self_payer | municipality | other). '
  'PII/sensitive — staff-scoped via the existing patients RLS policies. Row-level RLS '
  'covers this column; no column-level policy exists, so drivers who can read a patient '
  'row (assigned active ride) technically see it — application code must NOT expose it to '
  'driver views or the driver order-sheet copy.';

-- -----------------------------------------------------------------------------
-- 3. RLS
-- -----------------------------------------------------------------------------
-- No new policy required. RLS on public.patients is row-level and already:
--   * patients_select_staff  — admin/operator full read (covers this column)
--   * patients_insert_staff  — only admin/operator may insert
--   * patients_update_staff  — only admin/operator may update
-- These column-agnostic policies already scope the new column to staff for writes.
