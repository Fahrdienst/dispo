-- =============================================================================
-- Migration: Restrict Storage Upload Paths (SEC-008)
-- =============================================================================
-- The original "Admins can upload org files" policy allows uploading any file
-- to the organization bucket. This restricts uploads to logo files only.
-- =============================================================================

-- Drop the unrestricted upload policy
DROP POLICY IF EXISTS "Admins can upload org files" ON storage.objects;

-- Recreate with path restriction: only logo files allowed
CREATE POLICY "Admins can upload org files"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'organization'
        AND (storage.filename(name) LIKE 'logo.%' OR name LIKE 'logo/%')
        AND public.get_user_role() = 'admin'
    );
