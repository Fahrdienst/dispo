-- Add polyline column to rides table for route caching
ALTER TABLE public.rides ADD COLUMN polyline text;

COMMENT ON COLUMN public.rides.polyline IS 'Encoded polyline of the calculated route from Google Directions API.';
