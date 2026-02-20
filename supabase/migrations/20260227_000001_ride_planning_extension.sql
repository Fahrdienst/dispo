-- =============================================================
-- ADR-008: Ride Planning Extension
-- Adds appointment time fields and parent-child ride linking.
--
-- Changes:
--   1. Add parent_ride_id (self-FK) for outbound/return linking
--   2. Add appointment_time, appointment_end_time, return_pickup_time
--   3. Index on parent_ride_id for fast child lookup
-- =============================================================

-- -------------------------------------------------------------
-- 1. Parent-Child ride linking
-- -------------------------------------------------------------

ALTER TABLE public.rides
  ADD COLUMN parent_ride_id uuid REFERENCES public.rides(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.rides.parent_ride_id IS
  'Links a return ride to its outbound parent. NULL for outbound rides and standalone rides.';

-- Index for: "find all return rides for this outbound ride"
CREATE INDEX idx_rides_parent ON public.rides (parent_ride_id)
  WHERE parent_ride_id IS NOT NULL;

-- -------------------------------------------------------------
-- 2. Appointment time fields
-- -------------------------------------------------------------

ALTER TABLE public.rides
  ADD COLUMN appointment_time     time,
  ADD COLUMN appointment_end_time time,
  ADD COLUMN return_pickup_time   time;

COMMENT ON COLUMN public.rides.appointment_time IS
  'Scheduled start of the medical appointment at the destination.';
COMMENT ON COLUMN public.rides.appointment_end_time IS
  'Scheduled end of the medical appointment at the destination.';
COMMENT ON COLUMN public.rides.return_pickup_time IS
  'Planned pickup time for the return ride (on the outbound ride record).';

-- -------------------------------------------------------------
-- 3. Partial CHECK: appointment_end > appointment_start
--    Only when both are set. Lightweight DB-level safety net.
-- -------------------------------------------------------------

ALTER TABLE public.rides
  ADD CONSTRAINT rides_appointment_time_order
  CHECK (
    appointment_time IS NULL
    OR appointment_end_time IS NULL
    OR appointment_end_time > appointment_time
  );

-- Partial CHECK: pickup_time < appointment_time (when both set)
ALTER TABLE public.rides
  ADD CONSTRAINT rides_pickup_before_appointment
  CHECK (
    pickup_time IS NULL
    OR appointment_time IS NULL
    OR pickup_time < appointment_time
  );

-- Partial CHECK: return_pickup_time >= appointment_end_time (when both set)
ALTER TABLE public.rides
  ADD CONSTRAINT rides_return_after_appointment_end
  CHECK (
    return_pickup_time IS NULL
    OR appointment_end_time IS NULL
    OR return_pickup_time >= appointment_end_time
  );
