-- =============================================================================
-- Migration: Feedback Screenshot Storage (Issue #88)
-- =============================================================================
-- Private bucket for screenshots attached to in-app feedback.
--
-- Screenshots are uploaded server-side via the service-role client and embedded
-- into GitHub issues via signed URLs. There is NO public read and NO client
-- (anon/authenticated) access of any kind.
--
-- Security model:
--   * The bucket is private (public = false), so there is no anonymous read.
--   * RLS on storage.objects is deny-by-default: because we deliberately create
--     NO policy that references the 'feedback' bucket, no `anon` or
--     `authenticated` role can SELECT/INSERT/UPDATE/DELETE its objects.
--   * The `service_role` key bypasses RLS entirely, so the server-side upload
--     and signed-URL generation continue to work without an explicit policy.
--
-- IMPORTANT: We must NOT add a broad permissive policy here. Policies on
-- storage.objects are OR-combined, so a "FOR ALL" allow-policy would widen
-- access to every other bucket. Default-deny is exactly what we want.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback', 'feedback', false)
ON CONFLICT (id) DO NOTHING;
