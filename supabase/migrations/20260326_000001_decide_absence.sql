-- M12: Dispatch approval of driver absences (Issue #103)
--
-- Staff (admin/operator) approve or reject a driver's *requested* absence.
-- The decision is a narrow, audited write path via a SECURITY DEFINER RPC that
-- stamps decided_by/decided_at server-side. Direct table UPDATEs by staff are
-- removed (see policy drop below) so that decisions cannot be forged.
--
-- Security:
--   * SECURITY DEFINER with SET search_path = public               [SEC-002]
--   * Role gate: only admin/operator may decide                    [SEC-003]
--   * Transition guard: only status = 'requested' can be decided
--     (no rejected->approved, approved->rejected, re-deciding, etc.)
--   * decided_by is ALWAYS auth.uid(), NEVER a client argument     [audit]
--   * REVOKE ALL from PUBLIC, GRANT EXECUTE to authenticated only

-- =============================================================
-- 1: decide_absence
--    Approve or reject a still-'requested' absence.
-- =============================================================

CREATE OR REPLACE FUNCTION public.decide_absence(
  p_absence_id uuid,
  p_decision   absence_status,
  p_note       text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows int;
BEGIN
  -- Role gate: only dispatch staff may decide.
  IF public.get_user_role() NOT IN ('admin', 'operator') THEN
    RAISE EXCEPTION 'Only admin/operator may decide absences';
  END IF;

  -- Only 'approved' or 'rejected' are valid decisions. 'cancelled'/'requested'
  -- must never be reachable through this RPC.
  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid decision: %, expected approved or rejected', p_decision;
  END IF;

  -- Transition guard: the row must currently be 'requested'. The WHERE clause
  -- enforces the transition atomically; a ROW_COUNT of 0 means the row is
  -- missing or already in a terminal/decided state (no re-deciding).
  UPDATE public.driver_absences
     SET status        = p_decision,
         decided_by    = auth.uid(),   -- NEVER from a client argument
         decided_at    = now(),
         decision_note = p_note
   WHERE id = p_absence_id
     AND status = 'requested';

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'Absence not found or not in a decidable state (must be requested)';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.decide_absence(uuid, absence_status, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decide_absence(uuid, absence_status, text) TO authenticated;

-- =============================================================
-- 2: Drop the broad staff UPDATE policy
--    [SEC review #103] `absences_update_staff` (20260324_000001) only checked
--    the caller's role. That allowed any admin/operator to UPDATE a row
--    directly via PostgREST -- re-homing driver_id, forging decided_by, or
--    flipping status past the state machine. Staff decisions now flow
--    EXCLUSIVELY through decide_absence(), which stamps decided_by from
--    auth.uid() and enforces the requested->approved/rejected transition.
--    With no UPDATE policy remaining, direct table UPDATEs by staff are denied
--    by RLS; only the SECURITY DEFINER RPC can mutate the row.
--
--    !! DO NOT re-introduce a broad staff UPDATE policy as a "fix" for a missing
--    write path (e.g. staff withdrawing an approved absence, approved->cancelled).
--    That reopens the forge-decided_by / re-home-driver_id gap. Instead add a new
--    narrow SECURITY DEFINER RPC (stamping decided_by from auth.uid()) for each
--    additional controlled staff write.
-- =============================================================

DROP POLICY IF EXISTS absences_update_staff ON public.driver_absences;
