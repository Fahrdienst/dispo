-- KM-03: Fix invalid geocode_status in GDPR anonymization.
--
-- 20260321_000001_gdpr_anonymization.sql set geocode_status = 'none' in
-- anonymize_patient(), but the CHECK constraint from
-- 20260228_000001_geodata_fields.sql only permits
-- ('pending', 'success', 'failed', 'manual'). Anonymizing a patient therefore
-- raised a constraint-violation at runtime.
--
-- Fix: use 'pending'. Anonymized records have lat/lng = NULL, so 'pending' is
-- the semantically correct state (no coordinates yet / to be re-evaluated) and
-- keeps them out of the 'failed' bucket in the geocoding backfill.
CREATE OR REPLACE FUNCTION anonymize_patient(p_patient_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check for active rides
    IF EXISTS (
        SELECT 1 FROM rides
        WHERE patient_id = p_patient_id
        AND status NOT IN ('completed', 'cancelled', 'no_show')
        AND is_active = true
    ) THEN
        RAISE EXCEPTION 'Patient hat noch aktive Fahrten und kann nicht anonymisiert werden';
    END IF;

    -- Anonymize personal data
    UPDATE patients SET
        first_name = 'ANONYMISIERT',
        last_name = 'ANONYMISIERT',
        phone = NULL,
        street = NULL,
        house_number = NULL,
        postal_code = LEFT(postal_code, 2) || '00',  -- Reduce to region for statistics
        city = city,  -- Keep city for statistics
        notes = NULL,
        comment = NULL,
        emergency_contact_name = NULL,
        emergency_contact_phone = NULL,
        formatted_address = NULL,
        lat = NULL,
        lng = NULL,
        place_id = NULL,
        geocode_status = 'pending',  -- was 'none' (invalid per CHECK constraint)
        geocode_updated_at = NULL,
        is_active = false,
        updated_at = NOW()
    WHERE id = p_patient_id;

    -- Remove impairments (personal health data)
    DELETE FROM patient_impairments WHERE patient_id = p_patient_id;

    -- Deactivate associated ride series
    UPDATE ride_series SET
        is_active = false,
        notes = NULL,
        updated_at = NOW()
    WHERE patient_id = p_patient_id;

    -- Anonymize communication log entries
    UPDATE communication_log SET
        message = '[Anonymisiert gemaess DSGVO Art. 17]'
    WHERE ride_id IN (SELECT id FROM rides WHERE patient_id = p_patient_id);
END;
$$;

-- Preserve the least-privilege grant from the original migration.
REVOKE ALL ON FUNCTION anonymize_patient(UUID) FROM PUBLIC;
