-- =============================================================================
-- Migration 011: Archive Function for GDPR-compliant Data Management
-- =============================================================================
-- Issue #52: Workflow 9.3 - Datenarchivierung
--
-- This function provides database-level archiving of old rides:
-- 1. Cancels stale planned/confirmed rides older than threshold
-- 2. Cleans up application logs older than 30 days
-- 3. Respects completed rides (retention required)
--
-- Usage:
--   SELECT * FROM archive_old_rides(12); -- Archive rides older than 12 months
-- =============================================================================

-- Archive function
CREATE OR REPLACE FUNCTION archive_old_rides(months_old INTEGER DEFAULT 12)
RETURNS TABLE (archived_rides_count BIGINT, deleted_logs_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cutoff_date TIMESTAMPTZ;
  log_cutoff_date TIMESTAMPTZ;
  v_archived_rides BIGINT;
  v_deleted_logs BIGINT;
BEGIN
  -- Validate input
  IF months_old < 1 OR months_old > 120 THEN
    RAISE EXCEPTION 'months_old must be between 1 and 120';
  END IF;

  cutoff_date := NOW() - (months_old || ' months')::INTERVAL;
  log_cutoff_date := NOW() - INTERVAL '30 days';

  -- Step 1: Cancel stale planned/confirmed rides
  WITH cancelled AS (
    UPDATE rides
    SET
      status = 'cancelled',
      cancelled_at = NOW(),
      cancellation_reason = format('Automatisch archiviert (aelter als %s Monate)', months_old)
    WHERE pickup_time < cutoff_date
      AND status IN ('planned', 'confirmed')
    RETURNING id
  )
  SELECT COUNT(*) INTO v_archived_rides FROM cancelled;

  -- Step 2: Clean up old application logs
  WITH deleted AS (
    DELETE FROM application_logs
    WHERE created_at < log_cutoff_date
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_logs FROM deleted;

  RETURN QUERY SELECT v_archived_rides, v_deleted_logs;
END;
$$;

-- Grant execute permission to authenticated users (RLS will still apply)
GRANT EXECUTE ON FUNCTION archive_old_rides(INTEGER) TO authenticated;

-- Comment for documentation
COMMENT ON FUNCTION archive_old_rides IS
  'Archives old rides by cancelling stale planned/confirmed rides and cleaning up old logs. '
  'Completed rides are never modified (10-year retention requirement). '
  'GDPR: Patient transport records must be retained for 10 years per Swiss medical records regulation.';
