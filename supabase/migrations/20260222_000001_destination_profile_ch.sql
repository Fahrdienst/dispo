-- M6: Destination Profile -- Swiss Requirements (Zieleprofil)
-- Renames name -> display_name, adds contact person fields,
-- replaces destination_type with facility_type enum,
-- adds CH postal code validation, migrates notes -> comment.

-- =============================================================
-- 1a: Rename name -> display_name
-- =============================================================

ALTER TABLE public.destinations
  RENAME COLUMN name TO display_name;

ALTER TABLE public.destinations
  DROP CONSTRAINT destinations_name_check;

ALTER TABLE public.destinations
  ADD CONSTRAINT destinations_display_name_check
  CHECK (length(display_name) > 0);

-- =============================================================
-- 1b: New contact person columns
-- =============================================================

ALTER TABLE public.destinations
  ADD COLUMN contact_first_name text,
  ADD COLUMN contact_last_name  text,
  ADD COLUMN contact_phone      text;

ALTER TABLE public.destinations
  ADD CONSTRAINT destinations_contact_first_name_max
  CHECK (contact_first_name IS NULL OR length(contact_first_name) <= 100);

ALTER TABLE public.destinations
  ADD CONSTRAINT destinations_contact_last_name_max
  CHECK (contact_last_name IS NULL OR length(contact_last_name) <= 100);

ALTER TABLE public.destinations
  ADD CONSTRAINT destinations_contact_phone_max
  CHECK (contact_phone IS NULL OR length(contact_phone) <= 50);

-- =============================================================
-- 1c: Add comment column, migrate notes -> comment, drop notes
-- =============================================================

ALTER TABLE public.destinations
  ADD COLUMN comment text;

ALTER TABLE public.destinations
  ADD CONSTRAINT destinations_comment_max_length
  CHECK (comment IS NULL OR length(comment) <= 2000);

UPDATE public.destinations
  SET comment = notes
  WHERE notes IS NOT NULL;

ALTER TABLE public.destinations
  DROP COLUMN notes;

-- =============================================================
-- 1d: CH postal code validation
-- =============================================================

ALTER TABLE public.destinations
  ADD CONSTRAINT destinations_postal_code_ch
  CHECK (postal_code IS NULL OR postal_code ~ '^\d{4}$');

-- =============================================================
-- 1e: Replace destination_type enum with facility_type
-- =============================================================

CREATE TYPE public.facility_type AS ENUM (
  'practice',
  'hospital',
  'therapy_center',
  'day_care',
  'other'
);

ALTER TABLE public.destinations
  ADD COLUMN facility_type public.facility_type;

UPDATE public.destinations SET facility_type = CASE
  WHEN type = 'hospital' THEN 'hospital'::public.facility_type
  WHEN type = 'doctor'   THEN 'practice'::public.facility_type
  WHEN type = 'therapy'  THEN 'therapy_center'::public.facility_type
  WHEN type = 'other'    THEN 'other'::public.facility_type
  ELSE 'other'::public.facility_type
END;

ALTER TABLE public.destinations
  ALTER COLUMN facility_type SET NOT NULL;

ALTER TABLE public.destinations
  ALTER COLUMN facility_type SET DEFAULT 'other'::public.facility_type;

ALTER TABLE public.destinations
  DROP COLUMN type;

DROP TYPE public.destination_type;

-- =============================================================
-- 1f: Update indexes
-- =============================================================

DROP INDEX IF EXISTS public.idx_destinations_active;

CREATE INDEX idx_destinations_display_name
  ON public.destinations (display_name)
  WHERE is_active = true;

CREATE INDEX idx_destinations_facility_type
  ON public.destinations (facility_type)
  WHERE is_active = true;

CREATE INDEX idx_destinations_city
  ON public.destinations (city)
  WHERE is_active = true AND city IS NOT NULL;
