-- Add appointment time columns to ride_series for template-based ride generation
ALTER TABLE public.ride_series
  ADD COLUMN appointment_time time,
  ADD COLUMN appointment_end_time time,
  ADD COLUMN return_pickup_time time;
