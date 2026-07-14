-- M12: Driver Self-Service -- Driver Absences (Issue #91)
-- Drivers request absences (vacation / sick / training / other);
-- staff (admin/operator) approve or reject. Cancellation is a soft
-- status change ('cancelled') via RPC, never a hard DELETE.
--
-- Security notes:
--   * RLS enabled; drivers see/insert only their own rows.
--   * Staff-only UPDATE with explicit WITH CHECK (SEC-003/005): a driver
--     can never mutate rows and can never be re-homed to a foreign driver_id.
--   * No DELETE policy on purpose (cancel = status change).

-- =============================================================
-- 0: Extension -- btree_gist enables equality (driver_id) inside a
--    GiST exclusion constraint alongside the range overlap operator.
-- =============================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- =============================================================
-- 1: Enum types
-- =============================================================

CREATE TYPE public.absence_type AS ENUM ('vacation', 'sick', 'training', 'other');
CREATE TYPE public.absence_status AS ENUM ('requested', 'approved', 'rejected', 'cancelled');

-- =============================================================
-- 2: Table
-- =============================================================

CREATE TABLE public.driver_absences (
  id             uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id      uuid            NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  type           absence_type    NOT NULL,
  status         absence_status  NOT NULL DEFAULT 'requested',
  start_date     date            NOT NULL,
  end_date       date            NOT NULL,
  reason         text,
  decided_by     uuid            REFERENCES public.profiles(id),
  decided_at     timestamptz,
  decision_note  text,
  created_at     timestamptz     NOT NULL DEFAULT now(),
  updated_at     timestamptz     NOT NULL DEFAULT now(),

  CONSTRAINT driver_absences_date_range CHECK (end_date >= start_date),

  -- Prevent overlapping *active* absences for the same driver.
  -- Only 'requested'/'approved' rows participate, so a cancelled or
  -- rejected period does not block a fresh request for the same dates.
  CONSTRAINT driver_absences_no_overlap
    EXCLUDE USING gist (
      driver_id WITH =,
      daterange(start_date, end_date, '[]') WITH &&
    ) WHERE (status IN ('requested', 'approved'))
);

-- =============================================================
-- 3: updated_at trigger (reuses shared handle_updated_at)
-- =============================================================

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.driver_absences
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================
-- 4: Indexes
-- =============================================================

-- Driver's own absences, chronological
CREATE INDEX idx_driver_absences_driver_start
  ON public.driver_absences (driver_id, start_date);

-- Staff queue: "all requested absences"
CREATE INDEX idx_driver_absences_status
  ON public.driver_absences (status);

-- Date-range lookups: "who is absent on 2026-07-20?"
CREATE INDEX idx_driver_absences_dates
  ON public.driver_absences (start_date, end_date);

-- =============================================================
-- 5: Row Level Security
-- =============================================================

ALTER TABLE public.driver_absences ENABLE ROW LEVEL SECURITY;

-- Drivers can read their own absences
CREATE POLICY absences_select_own ON public.driver_absences
  FOR SELECT USING (
    public.get_user_role() = 'driver'
    AND driver_id = public.get_user_driver_id()
  );

-- Staff can read all absences
CREATE POLICY absences_select_staff ON public.driver_absences
  FOR SELECT USING (public.get_user_role() IN ('admin', 'operator'));

-- Drivers can request an absence only for themselves and only as 'requested'.
-- [SEC review] The decision fields must stay NULL on a driver's direct insert,
-- otherwise a driver could pre-forge decided_by/decision_note (audit spoofing)
-- via the PostgREST direct-insert path that runs alongside request_absence().
CREATE POLICY absences_insert_own ON public.driver_absences
  FOR INSERT WITH CHECK (
    public.get_user_role() = 'driver'
    AND driver_id = public.get_user_driver_id()
    AND status = 'requested'
    AND decided_by IS NULL
    AND decided_at IS NULL
    AND decision_note IS NULL
  );

-- [SEC-003/005] Only staff can update (approve/reject); explicit WITH CHECK
-- mirrors USING so a staff member cannot corrupt the row into an invalid state
-- and drivers are excluded from UPDATE entirely.
CREATE POLICY absences_update_staff ON public.driver_absences
  FOR UPDATE USING (public.get_user_role() IN ('admin', 'operator'))
  WITH CHECK (public.get_user_role() IN ('admin', 'operator'));

-- No DELETE policy: cancellation is a status change via cancel_own_absence().
