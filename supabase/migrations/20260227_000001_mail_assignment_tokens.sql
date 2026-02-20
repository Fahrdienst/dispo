-- M7: Assignment tokens for driver email notifications
-- and mail log for audit trail

-- ============================================================
-- 1. assignment_tokens
-- ============================================================
CREATE TABLE public.assignment_tokens (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id     uuid        NOT NULL REFERENCES public.rides(id),
  driver_id   uuid        NOT NULL REFERENCES public.drivers(id),
  token       text        NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_assignment_tokens_token ON public.assignment_tokens (token);
CREATE INDEX idx_assignment_tokens_ride ON public.assignment_tokens (ride_id);

-- ============================================================
-- 2. mail_log
-- ============================================================
CREATE TABLE public.mail_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id     uuid        REFERENCES public.rides(id),
  driver_id   uuid        REFERENCES public.drivers(id),
  template    text        NOT NULL,
  recipient   text        NOT NULL,
  status      text        NOT NULL DEFAULT 'sent',
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mail_log_ride ON public.mail_log (ride_id);

-- ============================================================
-- 3. RLS (Defense-in-depth)
-- ============================================================
ALTER TABLE public.assignment_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mail_log ENABLE ROW LEVEL SECURITY;

-- Staff-only SELECT for dashboard/audit
CREATE POLICY "Staff can view assignment tokens"
  ON public.assignment_tokens
  FOR SELECT
  USING (get_user_role() IN ('admin', 'operator'));

CREATE POLICY "Staff can view mail log"
  ON public.mail_log
  FOR SELECT
  USING (get_user_role() IN ('admin', 'operator'));

-- No INSERT/UPDATE/DELETE policies: all writes go through service-role client
