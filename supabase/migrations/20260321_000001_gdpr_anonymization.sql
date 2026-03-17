-- DSGVO Art. 17: Anonymization functions
-- Retention periods:
-- - Billing data (rides): 10 years
-- - Communication log: 3 years
-- - Patient data: deletion on request (after all rides completed)
-- - Driver data: deletion on request (after all rides completed)

-- Function: Anonymize patient
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
        geocode_status = 'none',
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

-- Function: Anonymize driver
CREATE OR REPLACE FUNCTION anonymize_driver(p_driver_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check for active rides
    IF EXISTS (
        SELECT 1 FROM rides
        WHERE driver_id = p_driver_id
        AND status NOT IN ('completed', 'cancelled', 'no_show')
        AND is_active = true
    ) THEN
        RAISE EXCEPTION 'Fahrer hat noch aktive Fahrten und kann nicht anonymisiert werden';
    END IF;

    -- Anonymize personal data
    UPDATE drivers SET
        first_name = 'ANONYMISIERT',
        last_name = 'ANONYMISIERT',
        phone = NULL,
        email = NULL,
        street = NULL,
        house_number = NULL,
        postal_code = NULL,
        city = NULL,
        vehicle = NULL,
        driving_license = NULL,
        emergency_contact_name = NULL,
        emergency_contact_phone = NULL,
        notes = NULL,
        is_active = false,
        updated_at = NOW()
    WHERE id = p_driver_id;

    -- Delete availability records
    DELETE FROM driver_availability WHERE driver_id = p_driver_id;

    -- Anonymize communication log entries for rides assigned to this driver
    UPDATE communication_log SET
        message = '[Anonymisiert gemaess DSGVO Art. 17]'
    WHERE ride_id IN (SELECT id FROM rides WHERE driver_id = p_driver_id);
END;
$$;

-- Permissions: Only callable via service role
REVOKE ALL ON FUNCTION anonymize_patient(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION anonymize_driver(UUID) FROM PUBLIC;
