-- Migration: Zonenmodell + Tarifmatrix (ADR-010, Issue #59)
-- Creates zones, zone_postal_codes, fare_versions, fare_rules tables
-- with RLS policies and updated_at triggers.

-- ============================================================
-- 1. TABLES
-- ============================================================

-- Geographic zone (collection of postal codes)
CREATE TABLE public.zones (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Mapping: postal code -> zone (M:1, one postal code belongs to exactly one zone)
CREATE TABLE public.zone_postal_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id     uuid NOT NULL REFERENCES public.zones(id) ON DELETE CASCADE,
  postal_code text NOT NULL,
  UNIQUE (postal_code)
);

-- Fare versions (time-based pricing periods)
CREATE TABLE public.fare_versions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  valid_from  date NOT NULL,
  valid_to    date,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fare_versions_date_order CHECK (valid_to IS NULL OR valid_to > valid_from)
);

-- Fare rules: from_zone x to_zone -> price
CREATE TABLE public.fare_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fare_version_id uuid NOT NULL REFERENCES public.fare_versions(id) ON DELETE CASCADE,
  from_zone_id    uuid NOT NULL REFERENCES public.zones(id),
  to_zone_id      uuid NOT NULL REFERENCES public.zones(id),
  base_price      numeric(8,2) NOT NULL,
  price_per_km    numeric(6,2) NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fare_version_id, from_zone_id, to_zone_id)
);

-- ============================================================
-- 2. INDICES
-- ============================================================

CREATE INDEX idx_zone_postal_codes_postal_code ON public.zone_postal_codes(postal_code);
CREATE INDEX idx_zone_postal_codes_zone_id ON public.zone_postal_codes(zone_id);
CREATE INDEX idx_fare_rules_version ON public.fare_rules(fare_version_id);
CREATE INDEX idx_fare_rules_zones ON public.fare_rules(from_zone_id, to_zone_id);

-- ============================================================
-- 3. UPDATED_AT TRIGGERS
-- ============================================================

-- Reuse the existing handle_updated_at function if available,
-- otherwise create it idempotently.
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_zones_updated_at
  BEFORE UPDATE ON public.zones
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_fare_versions_updated_at
  BEFORE UPDATE ON public.fare_versions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_fare_rules_updated_at
  BEFORE UPDATE ON public.fare_rules
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 4. RLS POLICIES (ADR-010 Section 9)
-- ============================================================

-- zones: all authenticated users can read, admin+operator can manage
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "zones_select_authenticated" ON public.zones
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "zones_manage_staff" ON public.zones
  FOR ALL TO authenticated
  USING (get_user_role() IN ('admin', 'operator'))
  WITH CHECK (get_user_role() IN ('admin', 'operator'));

-- zone_postal_codes: all authenticated users can read, admin+operator can manage
ALTER TABLE public.zone_postal_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "zone_postal_codes_select_authenticated" ON public.zone_postal_codes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "zone_postal_codes_manage_staff" ON public.zone_postal_codes
  FOR ALL TO authenticated
  USING (get_user_role() IN ('admin', 'operator'))
  WITH CHECK (get_user_role() IN ('admin', 'operator'));

-- fare_versions: all authenticated users can read, only admin can manage
ALTER TABLE public.fare_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fare_versions_select_authenticated" ON public.fare_versions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "fare_versions_manage_admin" ON public.fare_versions
  FOR ALL TO authenticated
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- fare_rules: all authenticated users can read, only admin can manage
ALTER TABLE public.fare_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fare_rules_select_authenticated" ON public.fare_rules
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "fare_rules_manage_admin" ON public.fare_rules
  FOR ALL TO authenticated
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');
