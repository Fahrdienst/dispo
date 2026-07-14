-- =============================================================================
-- Migration: Organization Settings — Zeit-Puffer-Defaults (Issue #128)
-- =============================================================================
-- Macht die bisher hartkodierten Zeit-Puffer als Org-Standard konfigurierbar.
-- Ersetzt die Konstanten DEFAULT_PICKUP_BUFFER_MINUTES (5) und
-- DEFAULT_RETURN_BUFFER_MINUTES (15) aus src/lib/validations/rides.ts.
--
-- Defaults = heutige Konstantenwerte => kein Verhaltensbruch.
-- Puffer werden NICHT pro Fahrt persistiert (Design-Entscheidung #6, "simple
-- first"): sie liefern nur die vorgeschlagene, ueberschreibbare Abholzeit.
-- =============================================================================

-- Vorlauf-Puffer (Minuten), der vor der Fahrtdauer abgezogen wird, damit der
-- Fahrer rechtzeitig beim Patienten ist. Default 5 = DEFAULT_PICKUP_BUFFER_MINUTES.
ALTER TABLE organization_settings
    ADD COLUMN IF NOT EXISTS default_pickup_buffer_minutes INT NOT NULL DEFAULT 5;

-- Ein-/Aussteige-Zeit (Minuten) fuer das Boarding beim Patienten.
-- Default 0 (heute nicht separat modelliert).
ALTER TABLE organization_settings
    ADD COLUMN IF NOT EXISTS default_boarding_minutes INT NOT NULL DEFAULT 0;

-- Rueckfahr-Puffer (Minuten) zwischen appointment_end_time und
-- return_pickup_time. Default 15 = DEFAULT_RETURN_BUFFER_MINUTES.
ALTER TABLE organization_settings
    ADD COLUMN IF NOT EXISTS default_return_buffer_minutes INT NOT NULL DEFAULT 15;

-- Wertebereich absichern (0-120 Minuten), passend zur Zod-Validierung.
ALTER TABLE organization_settings
    DROP CONSTRAINT IF EXISTS organization_settings_buffer_range;
ALTER TABLE organization_settings
    ADD CONSTRAINT organization_settings_buffer_range CHECK (
        default_pickup_buffer_minutes BETWEEN 0 AND 120
        AND default_boarding_minutes BETWEEN 0 AND 120
        AND default_return_buffer_minutes BETWEEN 0 AND 120
    );
