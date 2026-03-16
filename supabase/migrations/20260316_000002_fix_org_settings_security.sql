-- =============================================================================
-- Migration: Fix organization_settings security issues (SEC-002, SEC-003)
-- =============================================================================
-- SEC-002: Replace unsafe update_updated_at_column() with handle_updated_at()
-- SEC-003: Replace direct profiles queries with get_user_role() in RLS policies
-- =============================================================================

-- -----------------------------------------------------------------------------
-- SEC-002: Fix trigger function
-- -----------------------------------------------------------------------------

-- Drop the trigger that references the unsafe function
DROP TRIGGER IF EXISTS organization_settings_updated_at ON organization_settings;

-- Drop the unsafe function (only used by organization_settings)
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Recreate trigger using the standard handle_updated_at() function
CREATE TRIGGER organization_settings_updated_at
    BEFORE UPDATE ON organization_settings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- SEC-003: Fix RLS policies to use get_user_role()
-- -----------------------------------------------------------------------------

-- Fix organization_settings UPDATE policy
DROP POLICY IF EXISTS "Admins can update org settings" ON organization_settings;
CREATE POLICY "Admins can update org settings"
    ON organization_settings FOR UPDATE TO authenticated
    USING (public.get_user_role() = 'admin');

-- Fix storage policies for 'organization' bucket
DROP POLICY IF EXISTS "Admins can upload org files" ON storage.objects;
CREATE POLICY "Admins can upload org files"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'organization' AND public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "Admins can update org files" ON storage.objects;
CREATE POLICY "Admins can update org files"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'organization' AND public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "Admins can delete org files" ON storage.objects;
CREATE POLICY "Admins can delete org files"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'organization' AND public.get_user_role() = 'admin');
