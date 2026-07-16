-- Assignment Events: append-only status history per ride (M15, Issue #164)
-- Structured, per-ride event log spanning multiple acceptance_tracking attempts.
-- Security findings honored:
--   #176 (CRITICAL): RLS mandatory. Staff read all, drivers read only their own.
--   #185 (MEDIUM):   append-only. Writes exclusively via service-role client.
--                    No user INSERT/UPDATE/DELETE policies. actor set server-side.
--   #181 (HIGH):     legally-binding proof still lives in the immutable audit_log;
--                    this table is the dispatcher-facing operational history.

-- 1. Create enums
CREATE TYPE assignment_event_type AS ENUM (
  'requested',
  'reminder_sent',
  'confirmed',
  'rejected',
  'timed_out',
  'reassigned',
  'cancelled'
);

CREATE TYPE assignment_actor AS ENUM (
  'dispatcher',
  'driver',
  'system'
);

-- 2. Create assignment_events table (append-only, no updated_at)
CREATE TABLE assignment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  acceptance_tracking_id uuid REFERENCES acceptance_tracking(id) ON DELETE SET NULL,
  event assignment_event_type NOT NULL,
  actor assignment_actor NOT NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT assignment_events_detail_length CHECK (
    detail IS NULL OR char_length(detail) <= 500
  )
);

-- 3. Index for the per-ride timeline query (ordered chronologically)
CREATE INDEX idx_assignment_events_ride_created
  ON assignment_events (ride_id, created_at);

-- 4. Index for driver lookups (RLS-scoped driver timeline)
CREATE INDEX idx_assignment_events_driver
  ON assignment_events (driver_id);

-- 5. Enable RLS
ALTER TABLE assignment_events ENABLE ROW LEVEL SECURITY;

-- Staff (admin/operator) can read all events
CREATE POLICY "Staff can view assignment events"
  ON assignment_events FOR SELECT
  USING (
    (SELECT get_user_role()) IN ('admin', 'operator')
  );

-- Drivers can read only their own events
CREATE POLICY "Drivers can view own assignment events"
  ON assignment_events FOR SELECT
  USING (
    (SELECT get_user_role()) = 'driver'
    AND driver_id = (SELECT get_user_driver_id())
  );

-- No INSERT/UPDATE/DELETE policies: append-only, writes exclusively via the
-- service-role (admin) client in Server Actions. actor/actor_id are derived
-- server-side from the authenticated session, never from client input (#185).
