-- =============================================================================
-- Dispo: Initial Database Schema
-- Migration: 20260218_000001_initial_schema.sql
--
-- Creates the complete schema for the Dispo patient transport dispatch system.
-- Based on ADR-002 with all security review fixes (SEC-001 through SEC-011) applied.
--
-- Migration order (FK dependency-safe):
--   1. Enum types
--   2. drivers, patients, destinations tables
--   3. profiles table (FK -> auth.users, drivers)
--   4. ride_series table (FK -> patients, destinations)
--   5. rides table (FK -> patients, destinations, drivers, ride_series)
--   6. driver_availability table (FK -> drivers)
--   7. communication_log table (FK -> rides, profiles)
--   8. handle_updated_at function + triggers
--   9. Helper functions (get_user_role, get_user_driver_id) with REVOKE/GRANT
--  10. Indexes
--  11. RLS enable on all tables
--  12. RLS policies (with security fixes)
--  13. handle_new_user function + trigger (with hardcoded role)
-- =============================================================================


-- =============================================================================
-- 1. ENUM TYPES
-- =============================================================================

-- User roles in the system
CREATE TYPE public.user_role AS ENUM ('admin', 'operator', 'driver');

-- Ride lifecycle status (see state machine in ADR-002 Section 5)
CREATE TYPE public.ride_status AS ENUM (
  'unplanned',
  'planned',
  'confirmed',
  'in_progress',
  'picked_up',
  'arrived',
  'completed',
  'cancelled',
  'no_show',
  'rejected'
);

-- Direction of a ride leg
CREATE TYPE public.ride_direction AS ENUM ('outbound', 'return', 'both');

-- Destination categories
CREATE TYPE public.destination_type AS ENUM ('hospital', 'doctor', 'therapy', 'other');

-- Vehicle capability classification
CREATE TYPE public.vehicle_type AS ENUM ('standard', 'wheelchair', 'stretcher');

-- Recurrence patterns for ride series
CREATE TYPE public.recurrence_type AS ENUM ('daily', 'weekly', 'biweekly', 'monthly');

-- Days of the week for availability scheduling
CREATE TYPE public.day_of_week AS ENUM (
  'monday', 'tuesday', 'wednesday', 'thursday',
  'friday', 'saturday', 'sunday'
);


-- =============================================================================
-- 2. DRIVERS TABLE
-- =============================================================================

CREATE TABLE public.drivers (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name    text          NOT NULL CHECK (length(first_name) > 0),
  last_name     text          NOT NULL CHECK (length(last_name) > 0),
  phone         text,
  vehicle_type  vehicle_type  NOT NULL DEFAULT 'standard',
  notes         text,
  is_active     boolean       NOT NULL DEFAULT true,
  created_at    timestamptz   NOT NULL DEFAULT now(),
  updated_at    timestamptz   NOT NULL DEFAULT now()
);


-- =============================================================================
-- 3. PATIENTS TABLE
-- =============================================================================

CREATE TABLE public.patients (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name       text        NOT NULL CHECK (length(first_name) > 0),
  last_name        text        NOT NULL CHECK (length(last_name) > 0),
  phone            text,
  street           text,
  house_number     text,
  postal_code      text,
  city             text,
  needs_wheelchair boolean     NOT NULL DEFAULT false,
  needs_stretcher  boolean     NOT NULL DEFAULT false,
  needs_companion  boolean     NOT NULL DEFAULT false,
  notes            text,
  is_active        boolean     NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);


-- =============================================================================
-- 4. DESTINATIONS TABLE
-- =============================================================================

CREATE TABLE public.destinations (
  id            uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text              NOT NULL CHECK (length(name) > 0),
  type          destination_type  NOT NULL DEFAULT 'other',
  street        text,
  house_number  text,
  postal_code   text,
  city          text,
  department    text,
  notes         text,
  is_active     boolean           NOT NULL DEFAULT true,
  created_at    timestamptz       NOT NULL DEFAULT now(),
  updated_at    timestamptz       NOT NULL DEFAULT now()
);


-- =============================================================================
-- 5. PROFILES TABLE (FK -> auth.users, drivers)
-- =============================================================================

CREATE TABLE public.profiles (
  id            uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role          user_role   NOT NULL DEFAULT 'operator',
  display_name  text        NOT NULL CHECK (length(display_name) > 0),
  driver_id     uuid        UNIQUE REFERENCES public.drivers(id),
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT profile_driver_link_check CHECK (
    (role = 'driver' AND driver_id IS NOT NULL)
    OR (role != 'driver' AND driver_id IS NULL)
  )
);


-- =============================================================================
-- 6. RIDE_SERIES TABLE (FK -> patients, destinations)
-- =============================================================================

CREATE TABLE public.ride_series (
  id              uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      uuid              NOT NULL REFERENCES public.patients(id),
  destination_id  uuid              NOT NULL REFERENCES public.destinations(id),
  recurrence_type recurrence_type   NOT NULL,
  days_of_week    day_of_week[],
  pickup_time     time              NOT NULL,
  direction       ride_direction    NOT NULL DEFAULT 'both',
  start_date      date              NOT NULL,
  end_date        date,
  notes           text,
  is_active       boolean           NOT NULL DEFAULT true,
  created_at      timestamptz       NOT NULL DEFAULT now(),
  updated_at      timestamptz       NOT NULL DEFAULT now(),

  CONSTRAINT valid_date_range CHECK (end_date IS NULL OR end_date >= start_date),
  CONSTRAINT weekly_requires_days CHECK (
    (recurrence_type IN ('weekly', 'biweekly') AND days_of_week IS NOT NULL AND array_length(days_of_week, 1) > 0)
    OR (recurrence_type NOT IN ('weekly', 'biweekly'))
  )
);


-- =============================================================================
-- 7. RIDES TABLE (FK -> patients, destinations, drivers, ride_series)
-- =============================================================================

CREATE TABLE public.rides (
  id              uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      uuid            NOT NULL REFERENCES public.patients(id),
  destination_id  uuid            NOT NULL REFERENCES public.destinations(id),
  driver_id       uuid            REFERENCES public.drivers(id),
  ride_series_id  uuid            REFERENCES public.ride_series(id),
  date            date            NOT NULL,
  pickup_time     time            NOT NULL,
  direction       ride_direction  NOT NULL DEFAULT 'outbound',
  status          ride_status     NOT NULL DEFAULT 'unplanned',
  notes           text,
  is_active       boolean         NOT NULL DEFAULT true,
  created_at      timestamptz     NOT NULL DEFAULT now(),
  updated_at      timestamptz     NOT NULL DEFAULT now()
);


-- =============================================================================
-- 8. DRIVER_AVAILABILITY TABLE (FK -> drivers)
-- =============================================================================

CREATE TABLE public.driver_availability (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id      uuid         NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  day_of_week    day_of_week,
  specific_date  date,
  start_time     time         NOT NULL,
  end_time       time         NOT NULL,
  is_active      boolean      NOT NULL DEFAULT true,
  created_at     timestamptz  NOT NULL DEFAULT now(),
  updated_at     timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT time_range_valid CHECK (end_time > start_time),
  CONSTRAINT exactly_one_schedule_type CHECK (
    (day_of_week IS NOT NULL AND specific_date IS NULL)
    OR (day_of_week IS NULL AND specific_date IS NOT NULL)
  )
);


-- =============================================================================
-- 9. COMMUNICATION_LOG TABLE (FK -> rides, profiles)
-- =============================================================================

CREATE TABLE public.communication_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id     uuid        NOT NULL REFERENCES public.rides(id),
  author_id   uuid        NOT NULL REFERENCES public.profiles(id),
  message     text        NOT NULL CHECK (length(message) > 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);


-- =============================================================================
-- 10. HANDLE_UPDATED_AT FUNCTION AND TRIGGERS
-- =============================================================================

-- [SEC-002] SET search_path = public on SECURITY DEFINER function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply to every table with updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.destinations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ride_series
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.rides
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.driver_availability
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- =============================================================================
-- 11. HELPER FUNCTIONS (with search_path + REVOKE/GRANT per SEC-002)
-- =============================================================================

-- Returns the role of the currently authenticated user
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles
  WHERE id = auth.uid() AND is_active = true;
$$;

-- [SEC-002] Restrict execution to authenticated users only
REVOKE ALL ON FUNCTION public.get_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;

-- Returns the driver_id linked to the current user (NULL if not a driver)
CREATE OR REPLACE FUNCTION public.get_user_driver_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT driver_id FROM public.profiles
  WHERE id = auth.uid() AND is_active = true;
$$;

-- [SEC-002] Restrict execution to authenticated users only
REVOKE ALL ON FUNCTION public.get_user_driver_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_driver_id() TO authenticated;


-- =============================================================================
-- 12. INDEXES
-- =============================================================================

-- === rides ===
-- Dispatch board: "show me all rides for a given date"
CREATE INDEX idx_rides_date ON public.rides (date);

-- Dispatch board with status filter: "unplanned rides for today"
CREATE INDEX idx_rides_date_status ON public.rides (date, status);

-- Driver view: "my rides today"
CREATE INDEX idx_rides_driver_date ON public.rides (driver_id, date)
  WHERE driver_id IS NOT NULL;

-- Ride series link: "all rides from this series"
CREATE INDEX idx_rides_series ON public.rides (ride_series_id)
  WHERE ride_series_id IS NOT NULL;

-- Patient history: "all rides for this patient"
CREATE INDEX idx_rides_patient ON public.rides (patient_id);

-- Active rides only (used in most queries)
CREATE INDEX idx_rides_active ON public.rides (is_active)
  WHERE is_active = true;

-- === driver_availability ===
-- Schedule lookup: "who is available on Mondays?"
CREATE INDEX idx_availability_day ON public.driver_availability (day_of_week, start_time)
  WHERE day_of_week IS NOT NULL AND is_active = true;

-- Date-specific lookup: "who is available on 2026-03-15?"
CREATE INDEX idx_availability_date ON public.driver_availability (specific_date, start_time)
  WHERE specific_date IS NOT NULL AND is_active = true;

-- Driver's own schedule
CREATE INDEX idx_availability_driver ON public.driver_availability (driver_id);

-- === patients ===
-- Name search for autocomplete
CREATE INDEX idx_patients_name ON public.patients (last_name, first_name)
  WHERE is_active = true;

-- === drivers ===
-- Active driver list
CREATE INDEX idx_drivers_active ON public.drivers (last_name, first_name)
  WHERE is_active = true;

-- === destinations ===
-- Active destination list
CREATE INDEX idx_destinations_active ON public.destinations (name)
  WHERE is_active = true;

-- === ride_series ===
-- Active series for a patient
CREATE INDEX idx_ride_series_patient ON public.ride_series (patient_id)
  WHERE is_active = true;

-- === communication_log ===
-- Log entries for a ride (chronological)
CREATE INDEX idx_comm_log_ride ON public.communication_log (ride_id, created_at);

-- === profiles ===
-- Lookup profile by driver link
CREATE INDEX idx_profiles_driver ON public.profiles (driver_id)
  WHERE driver_id IS NOT NULL;


-- =============================================================================
-- 13. ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_log ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- 14. RLS POLICIES (with all security fixes applied)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 14.1 profiles
-- -----------------------------------------------------------------------------

-- Users can read their own profile
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT USING (id = auth.uid());

-- Admins and operators can read all profiles
CREATE POLICY profiles_select_staff ON public.profiles
  FOR SELECT USING (public.get_user_role() IN ('admin', 'operator'));

-- Only admins can insert profiles (user creation is admin-only)
CREATE POLICY profiles_insert_admin ON public.profiles
  FOR INSERT WITH CHECK (public.get_user_role() = 'admin');

-- Only admins can update profiles
CREATE POLICY profiles_update_admin ON public.profiles
  FOR UPDATE USING (public.get_user_role() = 'admin');

-- -----------------------------------------------------------------------------
-- 14.2 patients
-- -----------------------------------------------------------------------------

-- Admins and operators: full read access
CREATE POLICY patients_select_staff ON public.patients
  FOR SELECT USING (public.get_user_role() IN ('admin', 'operator'));

-- Drivers: can read only patients assigned to their active rides
CREATE POLICY patients_select_driver ON public.patients
  FOR SELECT USING (
    public.get_user_role() = 'driver'
    AND id IN (
      SELECT patient_id FROM public.rides
      WHERE driver_id = public.get_user_driver_id()
        AND is_active = true
    )
  );

-- Only admins and operators can insert patients
CREATE POLICY patients_insert_staff ON public.patients
  FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'operator'));

-- Only admins and operators can update patients
CREATE POLICY patients_update_staff ON public.patients
  FOR UPDATE USING (public.get_user_role() IN ('admin', 'operator'));

-- -----------------------------------------------------------------------------
-- 14.3 drivers
-- -----------------------------------------------------------------------------

-- Admins and operators: full read access
CREATE POLICY drivers_select_staff ON public.drivers
  FOR SELECT USING (public.get_user_role() IN ('admin', 'operator'));

-- Drivers can read their own driver record
CREATE POLICY drivers_select_own ON public.drivers
  FOR SELECT USING (
    public.get_user_role() = 'driver'
    AND id = public.get_user_driver_id()
  );

-- Only admins and operators can insert drivers
CREATE POLICY drivers_insert_staff ON public.drivers
  FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'operator'));

-- Only admins and operators can update drivers
CREATE POLICY drivers_update_staff ON public.drivers
  FOR UPDATE USING (public.get_user_role() IN ('admin', 'operator'));

-- -----------------------------------------------------------------------------
-- 14.4 destinations
-- -----------------------------------------------------------------------------

-- All authenticated users can read destinations (needed for ride display)
CREATE POLICY destinations_select_all ON public.destinations
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only admins and operators can insert destinations
CREATE POLICY destinations_insert_staff ON public.destinations
  FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'operator'));

-- Only admins and operators can update destinations
CREATE POLICY destinations_update_staff ON public.destinations
  FOR UPDATE USING (public.get_user_role() IN ('admin', 'operator'));

-- -----------------------------------------------------------------------------
-- 14.5 ride_series
-- -----------------------------------------------------------------------------

-- Only admins and operators can access ride series
CREATE POLICY ride_series_select_staff ON public.ride_series
  FOR SELECT USING (public.get_user_role() IN ('admin', 'operator'));

CREATE POLICY ride_series_insert_staff ON public.ride_series
  FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'operator'));

CREATE POLICY ride_series_update_staff ON public.ride_series
  FOR UPDATE USING (public.get_user_role() IN ('admin', 'operator'));

-- -----------------------------------------------------------------------------
-- 14.6 rides
-- -----------------------------------------------------------------------------

-- Admins and operators: full read access
CREATE POLICY rides_select_staff ON public.rides
  FOR SELECT USING (public.get_user_role() IN ('admin', 'operator'));

-- [SEC-011] Drivers: can only see their assigned ACTIVE rides
CREATE POLICY rides_select_driver ON public.rides
  FOR SELECT USING (
    public.get_user_role() = 'driver'
    AND driver_id = public.get_user_driver_id()
    AND is_active = true
  );

-- Only admins and operators can create rides
CREATE POLICY rides_insert_staff ON public.rides
  FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'operator'));

-- Admins and operators can update any ride
CREATE POLICY rides_update_staff ON public.rides
  FOR UPDATE USING (public.get_user_role() IN ('admin', 'operator'));

-- [SEC-003/005] Drivers can update only their assigned rides with explicit WITH CHECK
CREATE POLICY rides_update_driver ON public.rides
  FOR UPDATE USING (
    public.get_user_role() = 'driver'
    AND driver_id = public.get_user_driver_id()
  ) WITH CHECK (
    public.get_user_role() = 'driver'
    AND driver_id = public.get_user_driver_id()
  );

-- -----------------------------------------------------------------------------
-- 14.7 driver_availability
-- -----------------------------------------------------------------------------

-- Admins and operators: full read/write access
CREATE POLICY availability_select_staff ON public.driver_availability
  FOR SELECT USING (public.get_user_role() IN ('admin', 'operator'));

CREATE POLICY availability_insert_staff ON public.driver_availability
  FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'operator'));

CREATE POLICY availability_update_staff ON public.driver_availability
  FOR UPDATE USING (public.get_user_role() IN ('admin', 'operator'));

-- Drivers can read their own availability
CREATE POLICY availability_select_own ON public.driver_availability
  FOR SELECT USING (
    public.get_user_role() = 'driver'
    AND driver_id = public.get_user_driver_id()
  );

-- -----------------------------------------------------------------------------
-- 14.8 communication_log
-- -----------------------------------------------------------------------------

-- Admins and operators: full read access
CREATE POLICY comm_log_select_staff ON public.communication_log
  FOR SELECT USING (public.get_user_role() IN ('admin', 'operator'));

-- Drivers: can read logs for their assigned active rides
CREATE POLICY comm_log_select_driver ON public.communication_log
  FOR SELECT USING (
    public.get_user_role() = 'driver'
    AND ride_id IN (
      SELECT id FROM public.rides
      WHERE driver_id = public.get_user_driver_id()
        AND is_active = true
    )
  );

-- [SEC-010] Restrict INSERT to ride-authorized users only
-- Users must set author_id to their own uid and must be authorized for the ride
CREATE POLICY comm_log_insert_auth ON public.communication_log
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND author_id = auth.uid()
    AND (
      public.get_user_role() IN ('admin', 'operator')
      OR (
        public.get_user_role() = 'driver'
        AND ride_id IN (
          SELECT id FROM public.rides
          WHERE driver_id = public.get_user_driver_id()
            AND is_active = true
        )
      )
    )
  );


-- =============================================================================
-- 15. HANDLE_NEW_USER FUNCTION AND TRIGGER
-- =============================================================================

-- [SEC-001] Role is HARDCODED to 'operator' -- never read from user metadata.
-- [SEC-002] SET search_path = public on SECURITY DEFINER function.
-- display_name is safely read from metadata with email as fallback.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.email),
    'operator'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
