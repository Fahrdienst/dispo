-- Prevent duplicate rides generated from the same series.
-- A series + date + pickup_time + direction must be unique.
-- Only applies to rides that belong to a series (ride_series_id IS NOT NULL).
CREATE UNIQUE INDEX IF NOT EXISTS idx_rides_series_unique
  ON public.rides (ride_series_id, date, pickup_time, direction)
  WHERE ride_series_id IS NOT NULL;
