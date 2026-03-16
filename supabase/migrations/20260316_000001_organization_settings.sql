-- =============================================================================
-- Migration: Organization Settings (Admin Panel)
-- =============================================================================
-- Singleton-Tabelle für Organisationseinstellungen, Branding und Feature-Flags
-- =============================================================================

-- Sicherstellen, dass die Trigger-Funktion existiert
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tabelle erstellen
CREATE TABLE IF NOT EXISTS organization_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Organisationsdaten
    org_name TEXT NOT NULL DEFAULT 'Fahrdienst',
    org_street TEXT,
    org_postal_code TEXT,
    org_city TEXT,
    org_country TEXT DEFAULT 'CH',
    org_phone TEXT,
    org_email TEXT,
    org_website TEXT,

    -- Branding
    logo_url TEXT,
    primary_color TEXT DEFAULT '#000000',
    secondary_color TEXT DEFAULT '#0066FF',

    -- Kommunikation Feature-Flags
    email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    sms_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    email_from_name TEXT DEFAULT 'Fahrdienst',
    email_from_address TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Singleton: Nur genau eine Zeile erlaubt
CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_settings_singleton
    ON organization_settings ((true));

-- Initialdaten einfügen
INSERT INTO organization_settings (org_name)
VALUES ('Fahrdienst')
ON CONFLICT DO NOTHING;

-- Trigger für updated_at
CREATE TRIGGER organization_settings_updated_at
    BEFORE UPDATE ON organization_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- RLS Policies
-- =============================================================================

ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;

-- Alle authentifizierten Nutzer können lesen
CREATE POLICY "Authenticated users can read org settings"
    ON organization_settings FOR SELECT TO authenticated USING (true);

-- Nur Admins können ändern
CREATE POLICY "Admins can update org settings"
    ON organization_settings FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =============================================================================
-- Storage Bucket für Logo
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('organization', 'organization', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can read org files"
    ON storage.objects FOR SELECT TO public
    USING (bucket_id = 'organization');

CREATE POLICY "Admins can upload org files"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'organization'
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can update org files"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
        bucket_id = 'organization'
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can delete org files"
    ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id = 'organization'
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );
