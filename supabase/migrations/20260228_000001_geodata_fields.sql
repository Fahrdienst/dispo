-- Migration: Add geodata fields to patients and destinations
-- Issue #56: DB Geodatenfelder (lat/lng, place_id, geocode_status)
-- ADR-010: Maps-Architektur und Zonenverrechnung

-- Geodata fields for patients
ALTER TABLE public.patients ADD COLUMN lat double precision;
ALTER TABLE public.patients ADD COLUMN lng double precision;
ALTER TABLE public.patients ADD COLUMN place_id text;
ALTER TABLE public.patients ADD COLUMN formatted_address text;
ALTER TABLE public.patients ADD COLUMN geocode_status text
  NOT NULL DEFAULT 'pending'
  CHECK (geocode_status IN ('pending', 'success', 'failed', 'manual'));
ALTER TABLE public.patients ADD COLUMN geocode_updated_at timestamptz;

-- Geodata fields for destinations
ALTER TABLE public.destinations ADD COLUMN lat double precision;
ALTER TABLE public.destinations ADD COLUMN lng double precision;
ALTER TABLE public.destinations ADD COLUMN place_id text;
ALTER TABLE public.destinations ADD COLUMN formatted_address text;
ALTER TABLE public.destinations ADD COLUMN geocode_status text
  NOT NULL DEFAULT 'pending'
  CHECK (geocode_status IN ('pending', 'success', 'failed', 'manual'));
ALTER TABLE public.destinations ADD COLUMN geocode_updated_at timestamptz;
