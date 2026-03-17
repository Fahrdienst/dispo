-- =============================================================================
-- Duebendorf Tariff Model
-- Replaces the old base_price + price_per_km model with fixed-price tariffs.
-- =============================================================================

-- New columns on rides for tariff calculation
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS duration_category text DEFAULT 'under_2h'
    CHECK (duration_category IN ('under_2h', 'over_2h'));

ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS is_tagesheim_imwil boolean DEFAULT false;

ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS has_escort boolean DEFAULT false;

ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS surcharge_amount numeric(8,2) DEFAULT 0;

ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS surcharge_details jsonb;

ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS waiting_minutes integer DEFAULT 0;

ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS tariff_zone text;

-- Comments
COMMENT ON COLUMN public.rides.duration_category IS 'under_2h or over_2h — determines the tariff for zone-based rides';
COMMENT ON COLUMN public.rides.is_tagesheim_imwil IS 'Special case: Tagesheim Imwil round trip (CHF 14)';
COMMENT ON COLUMN public.rides.has_escort IS 'Hospital escort surcharge (+CHF 20 for ausserkantonal)';
COMMENT ON COLUMN public.rides.surcharge_amount IS 'Total surcharge amount in CHF';
COMMENT ON COLUMN public.rides.surcharge_details IS 'JSON breakdown of surcharges applied';
COMMENT ON COLUMN public.rides.waiting_minutes IS 'Waiting time in minutes (informational)';
COMMENT ON COLUMN public.rides.tariff_zone IS 'Resolved tariff zone: gemeinde, zone_1, zone_2, zone_3, ausserkantonal';
