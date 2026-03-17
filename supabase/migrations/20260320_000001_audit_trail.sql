-- Audit Trail for GDPR compliance and traceability
-- GitHub Issue #70

CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Who
    user_id UUID REFERENCES auth.users(id),
    user_role TEXT,

    -- What
    action TEXT NOT NULL,           -- 'create', 'update', 'delete', 'status_change', 'login', 'deactivate', 'activate'
    entity_type TEXT NOT NULL,      -- 'ride', 'patient', 'driver', 'destination', 'user', 'organization', 'fare', 'zone'
    entity_id UUID,

    -- Details
    changes JSONB,                  -- { field: { old: ..., new: ... } } for updates
    metadata JSONB,                 -- Additional context data

    -- When
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_action ON audit_log(action);

-- RLS: Only admins can read the audit log, nobody can modify it
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit log"
    ON audit_log FOR SELECT TO authenticated
    USING (public.get_user_role() = 'admin');

-- No INSERT policy for authenticated -- we use the Service Role client
-- No UPDATE/DELETE -- Audit log is immutable
