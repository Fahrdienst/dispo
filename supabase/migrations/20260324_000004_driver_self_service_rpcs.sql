-- M12: Driver Self-Service -- RPCs (Issue #94)
--
-- Drivers cannot write to `drivers` directly (no table policy) and cannot
-- mutate `driver_absences` beyond inserting a request. These SECURITY DEFINER
-- functions provide the narrow, audited write paths, deriving the driver
-- identity from the session via get_user_driver_id() -- never from a client
-- argument. All functions:
--   * are SECURITY DEFINER with SET search_path = public   [SEC-002]
--   * REVOKE ALL from PUBLIC and GRANT EXECUTE to authenticated only
--   * raise if the caller is not linked to a driver profile

-- =============================================================
-- 1: update_own_driver_contact
--    Updates ONLY the whitelisted contact/address fields on the
--    caller's own driver row.
-- =============================================================

CREATE OR REPLACE FUNCTION public.update_own_driver_contact(
  p_phone        text,
  p_email        text,
  p_street       text,
  p_house_number text,
  p_postal_code  text,
  p_city         text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id uuid;
BEGIN
  v_driver_id := public.get_user_driver_id();
  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'Caller is not linked to a driver profile';
  END IF;

  UPDATE public.drivers
     SET phone        = p_phone,
         email        = p_email,
         street       = p_street,
         house_number = p_house_number,
         postal_code  = p_postal_code,
         city         = p_city
   WHERE id = v_driver_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_own_driver_contact(text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_own_driver_contact(text, text, text, text, text, text) TO authenticated;

-- =============================================================
-- 2: request_absence
--    Inserts a 'requested' absence for the caller's own driver.
--    The overlap exclusion constraint (20260324_000001) will reject
--    a request colliding with an existing active absence.
-- =============================================================

CREATE OR REPLACE FUNCTION public.request_absence(
  p_type       absence_type,
  p_start_date date,
  p_end_date   date,
  p_reason     text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id  uuid;
  v_absence_id uuid;
BEGIN
  v_driver_id := public.get_user_driver_id();
  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'Caller is not linked to a driver profile';
  END IF;

  INSERT INTO public.driver_absences (driver_id, type, status, start_date, end_date, reason)
  VALUES (v_driver_id, p_type, 'requested', p_start_date, p_end_date, p_reason)
  RETURNING id INTO v_absence_id;

  RETURN v_absence_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_absence(absence_type, date, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_absence(absence_type, date, date, text) TO authenticated;

-- =============================================================
-- 3: cancel_own_absence
--    Soft-cancels an absence the caller owns, only while it is still
--    'requested' or 'approved'. Any other case (foreign row, unknown id,
--    already cancelled/rejected) raises.
-- =============================================================

CREATE OR REPLACE FUNCTION public.cancel_own_absence(
  p_absence_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id uuid;
  v_rows      int;
BEGIN
  v_driver_id := public.get_user_driver_id();
  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'Caller is not linked to a driver profile';
  END IF;

  UPDATE public.driver_absences
     SET status = 'cancelled'
   WHERE id = p_absence_id
     AND driver_id = v_driver_id
     AND status IN ('requested', 'approved');

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'Absence not found, not owned by caller, or not in a cancellable state';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_own_absence(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_own_absence(uuid) TO authenticated;
