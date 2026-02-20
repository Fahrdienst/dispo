-- Migration: Add price snapshot fields to rides (ADR-010, Issue #60)
-- These fields store the calculated/overridden price for each ride,
-- along with the route distance and duration used for the calculation.

-- Route data (snapshot from Google Directions API)
ALTER TABLE public.rides ADD COLUMN distance_meters integer;
ALTER TABLE public.rides ADD COLUMN duration_seconds integer;

-- Price calculation result
ALTER TABLE public.rides ADD COLUMN calculated_price numeric(8,2);
ALTER TABLE public.rides ADD COLUMN fare_rule_id uuid REFERENCES public.fare_rules(id) ON DELETE SET NULL;

-- Manual price override (operator/admin)
ALTER TABLE public.rides ADD COLUMN price_override numeric(8,2);
ALTER TABLE public.rides ADD COLUMN price_override_reason text;

-- CHECK: override requires reason
ALTER TABLE public.rides ADD CONSTRAINT rides_override_requires_reason
  CHECK (price_override IS NULL OR price_override_reason IS NOT NULL);
