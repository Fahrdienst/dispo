-- M4 Step 2: Driver Profile -- Swiss Requirements
-- Adds address fields, vehicle description, driving license, emergency contact.

-- =============================================================
-- 2a: Address fields on drivers
-- =============================================================

ALTER TABLE public.drivers
  ADD COLUMN street         text,
  ADD COLUMN house_number   text,
  ADD COLUMN postal_code    text,
  ADD COLUMN city           text;

-- CH postal code: 4 digits when set
ALTER TABLE public.drivers
  ADD CONSTRAINT drivers_postal_code_ch
  CHECK (postal_code IS NULL OR postal_code ~ '^\d{4}$');

-- =============================================================
-- 2b: Vehicle description and driving license
-- =============================================================

ALTER TABLE public.drivers
  ADD COLUMN vehicle          text,
  ADD COLUMN driving_license  text;

-- Max length constraints
ALTER TABLE public.drivers
  ADD CONSTRAINT drivers_vehicle_max_length
  CHECK (vehicle IS NULL OR length(vehicle) <= 200);

ALTER TABLE public.drivers
  ADD CONSTRAINT drivers_driving_license_max_length
  CHECK (driving_license IS NULL OR length(driving_license) <= 100);

-- =============================================================
-- 2c: Emergency contact fields
-- =============================================================

ALTER TABLE public.drivers
  ADD COLUMN emergency_contact_name   text,
  ADD COLUMN emergency_contact_phone  text;

ALTER TABLE public.drivers
  ADD CONSTRAINT drivers_emergency_contact_name_max
  CHECK (emergency_contact_name IS NULL OR length(emergency_contact_name) <= 200);

ALTER TABLE public.drivers
  ADD CONSTRAINT drivers_emergency_contact_phone_max
  CHECK (emergency_contact_phone IS NULL OR length(emergency_contact_phone) <= 50);

-- =============================================================
-- 2d: Max length for existing fields (safety net)
-- =============================================================

ALTER TABLE public.drivers
  ADD CONSTRAINT drivers_street_max_length
  CHECK (street IS NULL OR length(street) <= 200);

ALTER TABLE public.drivers
  ADD CONSTRAINT drivers_house_number_max_length
  CHECK (house_number IS NULL OR length(house_number) <= 20);

ALTER TABLE public.drivers
  ADD CONSTRAINT drivers_city_max_length
  CHECK (city IS NULL OR length(city) <= 100);

ALTER TABLE public.drivers
  ADD CONSTRAINT drivers_phone_max_length
  CHECK (phone IS NULL OR length(phone) <= 50);

ALTER TABLE public.drivers
  ADD CONSTRAINT drivers_notes_max_length
  CHECK (notes IS NULL OR length(notes) <= 1000);
