-- M5: Patient Profile -- Swiss Requirements
-- Adds emergency contact, comment, CH postal code validation,
-- impairment enum + junction table, migrates boolean flags.

-- =============================================================
-- 2a: New columns on patients
-- =============================================================

ALTER TABLE public.patients
  ADD COLUMN emergency_contact_name text,
  ADD COLUMN emergency_contact_phone text,
  ADD COLUMN comment text;

-- CH postal code: 4 digits when set
ALTER TABLE public.patients
  ADD CONSTRAINT patients_postal_code_ch
  CHECK (postal_code IS NULL OR postal_code ~ '^\d{4}$');

-- Comment max length
ALTER TABLE public.patients
  ADD CONSTRAINT patients_comment_max_length
  CHECK (comment IS NULL OR length(comment) <= 2000);

-- =============================================================
-- 2b: Impairment enum + junction table
-- =============================================================

CREATE TYPE public.impairment_type AS ENUM (
  'rollator',
  'wheelchair',
  'stretcher',
  'companion'
);

CREATE TABLE public.patient_impairments (
  id              uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      uuid            NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  impairment_type impairment_type NOT NULL,
  created_at      timestamptz     NOT NULL DEFAULT now(),

  CONSTRAINT patient_impairment_unique UNIQUE (patient_id, impairment_type)
);

CREATE INDEX idx_patient_impairments_patient
  ON public.patient_impairments (patient_id);

-- =============================================================
-- 2c: Migrate existing boolean flags to junction table
-- =============================================================

INSERT INTO public.patient_impairments (patient_id, impairment_type)
SELECT id, 'wheelchair' FROM public.patients WHERE needs_wheelchair = true;

INSERT INTO public.patient_impairments (patient_id, impairment_type)
SELECT id, 'stretcher' FROM public.patients WHERE needs_stretcher = true;

INSERT INTO public.patient_impairments (patient_id, impairment_type)
SELECT id, 'companion' FROM public.patients WHERE needs_companion = true;

-- =============================================================
-- 2d: Drop old boolean columns
-- =============================================================

ALTER TABLE public.patients
  DROP COLUMN needs_wheelchair,
  DROP COLUMN needs_stretcher,
  DROP COLUMN needs_companion;

-- =============================================================
-- 2e: RLS for patient_impairments
-- =============================================================

ALTER TABLE public.patient_impairments ENABLE ROW LEVEL SECURITY;

-- Staff: full read access
CREATE POLICY patient_impairments_select_staff ON public.patient_impairments
  FOR SELECT USING (get_user_role() IN ('admin', 'operator'));

-- Driver: only impairments of patients on their active rides
CREATE POLICY patient_impairments_select_driver ON public.patient_impairments
  FOR SELECT USING (
    get_user_role() = 'driver'
    AND patient_id IN (
      SELECT r.patient_id FROM public.rides r
      WHERE r.driver_id = get_user_driver_id()
        AND r.is_active = true
    )
  );

-- Staff: insert
CREATE POLICY patient_impairments_insert_staff ON public.patient_impairments
  FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'operator'));

-- Staff: update
CREATE POLICY patient_impairments_update_staff ON public.patient_impairments
  FOR UPDATE USING (get_user_role() IN ('admin', 'operator'));

-- Staff: delete (used by replace-all strategy)
CREATE POLICY patient_impairments_delete_staff ON public.patient_impairments
  FOR DELETE USING (get_user_role() IN ('admin', 'operator'));
