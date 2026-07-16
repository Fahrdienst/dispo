-- Issue #127: Abhol-Ort-Override pro Fahrt.
--
-- Design-Entscheidung #4: Der Route-Start ist heute immer die Patienten-
-- Wohnadresse. Diese Migration macht den Abholort pro Fahrt ueberschreibbar,
-- ohne die Patientenadresse zu duplizieren.
--
-- Semantik: NULL => Patienten-Wohnadresse verwenden (Fallback in Route-/Preis-
-- Logik). Nur wenn tatsaechlich ein abweichender Abholort erfasst wird, werden
-- diese Spalten gesetzt (Freitext + geocodierte Koordinaten + Places-ID).
-- Idempotent via IF NOT EXISTS, damit ein erneuter Lauf gefahrlos ist.

ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS pickup_location_text TEXT NULL,
  ADD COLUMN IF NOT EXISTS pickup_lat DOUBLE PRECISION NULL,
  ADD COLUMN IF NOT EXISTS pickup_lng DOUBLE PRECISION NULL,
  ADD COLUMN IF NOT EXISTS pickup_place_id TEXT NULL;

COMMENT ON COLUMN public.rides.pickup_location_text IS
  'Abweichender Abholort (Freitext-Adresse). NULL = Patienten-Wohnadresse verwenden (Fallback in Route-/Preis-Logik).';
COMMENT ON COLUMN public.rides.pickup_lat IS
  'Geocodierte Breite des abweichenden Abholorts. NULL = Patienten-Wohnadresse verwenden.';
COMMENT ON COLUMN public.rides.pickup_lng IS
  'Geocodierte Laenge des abweichenden Abholorts. NULL = Patienten-Wohnadresse verwenden.';
COMMENT ON COLUMN public.rides.pickup_place_id IS
  'Google Place-ID des abweichenden Abholorts (Cache-Referenz). NULL = Patienten-Wohnadresse verwenden.';
