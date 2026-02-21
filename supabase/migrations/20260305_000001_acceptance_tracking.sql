-- Acceptance Tracking: Enums, Table, Indexes, RLS
-- Supports the driver acceptance flow with SLA escalation windows

-- 1. Create enums
CREATE TYPE acceptance_stage AS ENUM (
  'notified',
  'reminder_1',
  'reminder_2',
  'timed_out',
  'confirmed',
  'rejected',
  'cancelled'
);

CREATE TYPE rejection_reason AS ENUM (
  'schedule_conflict',
  'too_far',
  'vehicle_issue',
  'personal',
  'other'
);

CREATE TYPE resolution_method AS ENUM (
  'driver_email',
  'driver_app',
  'dispatcher_override',
  'timeout'
);

-- 2. Create acceptance_tracking table
CREATE TABLE acceptance_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  stage acceptance_stage NOT NULL DEFAULT 'notified',
  is_short_notice boolean NOT NULL DEFAULT false,
  notified_at timestamptz NOT NULL DEFAULT now(),
  reminder_1_at timestamptz,
  reminder_2_at timestamptz,
  resolved_at timestamptz,
  resolved_by resolution_method,
  rejection_reason_code rejection_reason,
  rejection_reason_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT rejection_text_length CHECK (
    rejection_reason_text IS NULL OR char_length(rejection_reason_text) <= 200
  )
);

-- 3. Partial unique index: max 1 active tracking per ride
CREATE UNIQUE INDEX idx_acceptance_tracking_active_ride
  ON acceptance_tracking (ride_id)
  WHERE stage IN ('notified', 'reminder_1', 'reminder_2');

-- 4. Index for cron queries (find pending escalations)
CREATE INDEX idx_acceptance_tracking_pending
  ON acceptance_tracking (stage, notified_at)
  WHERE stage IN ('notified', 'reminder_1', 'reminder_2');

-- 5. Index for driver lookups
CREATE INDEX idx_acceptance_tracking_driver
  ON acceptance_tracking (driver_id, stage);

-- 6. Enable RLS
ALTER TABLE acceptance_tracking ENABLE ROW LEVEL SECURITY;

-- Staff can read all tracking records
CREATE POLICY "Staff can view acceptance tracking"
  ON acceptance_tracking FOR SELECT
  USING (
    (SELECT get_user_role()) IN ('admin', 'operator')
  );

-- Drivers can read their own tracking records
CREATE POLICY "Drivers can view own acceptance tracking"
  ON acceptance_tracking FOR SELECT
  USING (
    (SELECT get_user_role()) = 'driver'
    AND driver_id = (SELECT get_user_driver_id())
  );

-- Writes happen via service-role (admin client), no user-facing INSERT/UPDATE/DELETE policies needed
