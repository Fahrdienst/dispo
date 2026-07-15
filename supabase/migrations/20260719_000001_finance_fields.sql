-- =============================================================================
-- Migration: Finanzmodul (M14) — Zustell- & Entschaedigungsfelder (Issue #144)
-- =============================================================================
-- Periphere Schema-Erweiterungen rund um das Finanzmodul.
--
-- Referenzen:
--   * docs/finanzmodul-konzept.md, Abschnitt 3.2–3.4
--   * docs/adrs/015-finance-module.md, Entscheid E8
-- =============================================================================


-- =============================================================================
-- 1. PATIENTS: Zustell-/Empfaengerfelder (Konzept 3.2)
-- =============================================================================
-- Alle optional. Zod-Validierung im PatientForm; bestehende patients-RLS deckt
-- den Schreibzugriff (admin/operator) ab.
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS email                     text,
  ADD COLUMN IF NOT EXISTS billing_recipient_name    text,
  ADD COLUMN IF NOT EXISTS billing_recipient_address text;

COMMENT ON COLUMN public.patients.email IS
  'Optionale E-Mail fuer den Quittungsversand (Zod-validiert).';
COMMENT ON COLUMN public.patients.billing_recipient_name IS
  'Abweichender Rechnungsempfaenger (z.B. Angehoerige/Beistand). Offenlegung an Dritte erfordert Rechtsgrundlage (SEC-M14-008).';
COMMENT ON COLUMN public.patients.billing_recipient_address IS
  'Adresse des abweichenden Empfaengers (mehrzeilig); faellt bei Ausstellung auf die Patientenadresse zurueck, wenn leer.';


-- =============================================================================
-- 2. ORGANIZATION_SETTINGS: Fahrer-Entschaedigungssaetze (Konzept 3.3)
-- =============================================================================
-- Typisierte numeric-Spalten (kein Key-Value-Store), Admin-editierbar ueber die
-- bestehende Admin-Update-Policy auf organization_settings.
ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS driver_comp_per_ride_chf numeric(8,2),
  ADD COLUMN IF NOT EXISTS driver_comp_per_km_chf   numeric(8,2);

COMMENT ON COLUMN public.organization_settings.driver_comp_per_ride_chf IS
  'Fahrer-Entschaedigung: Pauschale pro abgeschlossene Fahrt (CHF). Unversioniert (ADR-015); Report berechnet live.';
COMMENT ON COLUMN public.organization_settings.driver_comp_per_km_chf IS
  'Fahrer-Entschaedigung: Satz pro gefahrenem km (CHF). Unversioniert (ADR-015); Report berechnet live.';


-- =============================================================================
-- 3. RIDES: distance_source (Konzept 3.4, ADR-015 E8)
-- =============================================================================
-- Kennzeichnet die Herkunft der Distanzdaten fuer die Statistik.
--   planned   — aus der M8-Planung (Google Directions bei Erfassung)
--   backfill  — vom einmaligen Distanz-Backfill-Job (#145) nachgetragen
--   estimate  — manuell geschaetzt/eingegeben
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS distance_source text NOT NULL DEFAULT 'planned'
    CHECK (distance_source IN ('planned', 'backfill', 'estimate'));

COMMENT ON COLUMN public.rides.distance_source IS
  'Herkunft der Distanzdaten: planned | backfill | estimate (Default planned).';

-- Bestandsfahrten mit vorhandener Distanz stammen aus der M8-Planung → 'planned'
-- (der Spalten-Default deckt Neuzeilen ab; dieses UPDATE ist idempotent und
-- macht die retroaktive Markierung fuer bestehende Zeilen explizit).
UPDATE public.rides
   SET distance_source = 'planned'
 WHERE distance_meters IS NOT NULL
   AND distance_source IS DISTINCT FROM 'planned';
