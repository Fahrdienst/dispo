-- M4 Step 3: Convert driver_availability to fixed 2h slot model
-- Pre-MVP: no production data, safe to alter constraints directly.

-- =============================================================
-- 3a: Drop old constraints that conflict with new model
-- =============================================================

-- Drop the old generic time range check
ALTER TABLE public.driver_availability
  DROP CONSTRAINT time_range_valid;

-- =============================================================
-- 3b: Drop is_active and updated_at (slots are create/delete only)
-- =============================================================

-- Drop the updated_at trigger first
DROP TRIGGER IF EXISTS set_updated_at ON public.driver_availability;

ALTER TABLE public.driver_availability
  DROP COLUMN is_active,
  DROP COLUMN updated_at;

-- =============================================================
-- 3c: Add fixed slot constraints
-- =============================================================

-- Only allowed start times (08, 10, 12, 14, 16) with exactly 2h duration
ALTER TABLE public.driver_availability
  ADD CONSTRAINT valid_slot_start_time
  CHECK (start_time IN ('08:00:00', '10:00:00', '12:00:00', '14:00:00', '16:00:00'));

ALTER TABLE public.driver_availability
  ADD CONSTRAINT valid_slot_duration
  CHECK (end_time = start_time + interval '2 hours');

-- Weekday only (no saturday/sunday) for day_of_week entries
ALTER TABLE public.driver_availability
  ADD CONSTRAINT weekday_only
  CHECK (day_of_week IS NULL OR day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday'));

-- =============================================================
-- 3d: Unique constraints to prevent duplicate slots
-- =============================================================

-- One slot per driver per weekday per time
CREATE UNIQUE INDEX idx_availability_unique_weekly
  ON public.driver_availability (driver_id, day_of_week, start_time)
  WHERE day_of_week IS NOT NULL;

-- One slot per driver per specific date per time
CREATE UNIQUE INDEX idx_availability_unique_date
  ON public.driver_availability (driver_id, specific_date, start_time)
  WHERE specific_date IS NOT NULL;

-- =============================================================
-- 3e: Update existing indexes (adjust for removed is_active)
-- =============================================================

DROP INDEX IF EXISTS public.idx_availability_day;
DROP INDEX IF EXISTS public.idx_availability_date;

CREATE INDEX idx_availability_day ON public.driver_availability (day_of_week, start_time)
  WHERE day_of_week IS NOT NULL;

CREATE INDEX idx_availability_date ON public.driver_availability (specific_date, start_time)
  WHERE specific_date IS NOT NULL;
