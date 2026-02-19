-- =============================================================================
-- SEC-006: Deactivated users can still read destinations
-- =============================================================================
-- The destinations_select_all policy only checks auth.uid() IS NOT NULL,
-- allowing deactivated users (with a still-valid JWT, up to 1 hour) to read
-- all destinations. This adds an is_active check via the profiles table.
--
-- Note: profiles_select_own intentionally keeps NO is_active check — a
-- deactivated user reading their own profile is needed for proper
-- "Konto deaktiviert" error messages and is DSGVO Art. 15 compliant.
-- =============================================================================

DROP POLICY IF EXISTS destinations_select_all ON public.destinations;
CREATE POLICY destinations_select_all ON public.destinations
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_active = true
    )
  );
