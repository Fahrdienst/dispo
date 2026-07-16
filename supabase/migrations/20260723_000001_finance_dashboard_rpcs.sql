-- =============================================================================
-- Migration: Finanzmodul (M14) — Dashboard-Aggregations-RPCs (Issue #154)
-- =============================================================================
-- Phase 14.4 (Dashboard) aggregiert Umsatz/Fahrten/km serverseitig. Der
-- Supabase-JS-Client kann kein GROUP BY absetzen und PostgREST kappt Row-Sets
-- bei 1000 Zeilen — eine Aggregation im TS-Layer muesste dafuer zehntausende
-- Fahrten ueber die Leitung ziehen. Diese Funktionen fuehren die Aggregation in
-- SQL aus und liefern winzige Result-Sets zurueck (<=24 Monatszeilen bzw. Top-5).
--
-- ADR-015 E7: "direkte SQL-Aggregationen in Server Components" — bei diesem
-- Volumen genuegen Indexe (rides(date,status), rides(driver_id,date,status),
-- rides(destination_id,date,status)); KEINE Materialized Views.
--
-- Sicherheit:
--   * SECURITY INVOKER (Default): die Funktionen laufen mit den Rechten des
--     Aufrufers, die bestehende RLS auf rides/receipt_items/patients/... greift
--     weiterhin. Keine Privilegieneskalation.
--   * Zusaetzliches Rollen-Gate (admin/operator) als Defense-in-Depth, analog
--     zur /finance-Layout-Absicherung. Fahrer/anon werden abgewiesen.
--   * REVOKE ALL FROM PUBLIC, GRANT EXECUTE nur an authenticated.
--   * SET search_path = public (SEC-002-Konvention).
--
-- Preisquelle je Fahrt: COALESCE(price_override, calculated_price) — identisch
-- zum Fahrer-Report und zur Quittungs-Ausstellung.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Ergaenzende Indexe (idempotent) — decken die Dashboard-Dimensionen ab.
-- (ADR-015 E7. Legen wir defensiv mit IF NOT EXISTS an, falls fruehere Phasen
--  sie noch nicht gesetzt haben.)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_rides_date_status
  ON public.rides (date, status);
CREATE INDEX IF NOT EXISTS idx_rides_driver_date_status
  ON public.rides (driver_id, date, status);
CREATE INDEX IF NOT EXISTS idx_rides_destination_date_status
  ON public.rides (destination_id, date, status);


-- -----------------------------------------------------------------------------
-- 1: finance_dashboard_monthly
--    Monatsaggregate (completed, aktive Fahrten) ueber ein Datumsfenster.
--    Liefert NUR nicht-leere Monate; das Auffuellen leerer Monate uebernimmt
--    die reine TS-Logik (buildMonthTimeline/buildChartSeries).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finance_dashboard_monthly(
  p_from date,
  p_to   date
)
RETURNS TABLE (
  month        date,
  ride_count   bigint,
  revenue      numeric,
  total_meters bigint
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  v_role := public.get_user_role();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'operator') THEN
    RAISE EXCEPTION 'Nur Administratoren/Operatoren duerfen Finanzstatistiken lesen';
  END IF;

  RETURN QUERY
  SELECT
    date_trunc('month', r.date)::date                                    AS month,
    count(*)::bigint                                                      AS ride_count,
    COALESCE(SUM(COALESCE(r.price_override, r.calculated_price)), 0)::numeric AS revenue,
    COALESCE(SUM(r.distance_meters), 0)::bigint                           AS total_meters
  FROM public.rides r
  WHERE r.status = 'completed'
    AND r.is_active = true
    AND r.date BETWEEN p_from AND p_to
  GROUP BY date_trunc('month', r.date)
  ORDER BY 1;
END;
$$;

REVOKE ALL ON FUNCTION public.finance_dashboard_monthly(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_dashboard_monthly(date, date) TO authenticated;


-- -----------------------------------------------------------------------------
-- 2: finance_dashboard_top_destinations
--    Haeufigste Ziele im Zeitraum, sortiert + limitiert (kleines Result-Set).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finance_dashboard_top_destinations(
  p_from  date,
  p_to    date,
  p_limit int
)
RETURNS TABLE (
  id         uuid,
  label      text,
  ride_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  v_role := public.get_user_role();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'operator') THEN
    RAISE EXCEPTION 'Nur Administratoren/Operatoren duerfen Finanzstatistiken lesen';
  END IF;

  RETURN QUERY
  SELECT
    d.id,
    d.display_name AS label,
    count(*)::bigint AS ride_count
  FROM public.rides r
  JOIN public.destinations d ON d.id = r.destination_id
  WHERE r.status = 'completed'
    AND r.is_active = true
    AND r.date BETWEEN p_from AND p_to
  GROUP BY d.id, d.display_name
  ORDER BY ride_count DESC, d.display_name ASC
  LIMIT GREATEST(p_limit, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.finance_dashboard_top_destinations(date, date, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_dashboard_top_destinations(date, date, int) TO authenticated;


-- -----------------------------------------------------------------------------
-- 3: finance_dashboard_top_patients
--    Patienten nach Fahrtenzahl. Nur admin/operator (Rollen-Gate + RLS).
--    Gesundheitskontext bleibt aussen vor (nur Name + Anzahl).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finance_dashboard_top_patients(
  p_from  date,
  p_to    date,
  p_limit int
)
RETURNS TABLE (
  id         uuid,
  label      text,
  ride_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  v_role := public.get_user_role();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'operator') THEN
    RAISE EXCEPTION 'Nur Administratoren/Operatoren duerfen Finanzstatistiken lesen';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    btrim(p.last_name || ', ' || p.first_name) AS label,
    count(*)::bigint AS ride_count
  FROM public.rides r
  JOIN public.patients p ON p.id = r.patient_id
  WHERE r.status = 'completed'
    AND r.is_active = true
    AND r.date BETWEEN p_from AND p_to
  GROUP BY p.id, p.last_name, p.first_name
  ORDER BY ride_count DESC, label ASC
  LIMIT GREATEST(p_limit, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.finance_dashboard_top_patients(date, date, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_dashboard_top_patients(date, date, int) TO authenticated;


-- -----------------------------------------------------------------------------
-- 4: finance_dashboard_top_drivers
--    Aktivste Fahrer nach abgeschlossenen Fahrten (nur zugewiesene Fahrten).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finance_dashboard_top_drivers(
  p_from  date,
  p_to    date,
  p_limit int
)
RETURNS TABLE (
  id         uuid,
  label      text,
  ride_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  v_role := public.get_user_role();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'operator') THEN
    RAISE EXCEPTION 'Nur Administratoren/Operatoren duerfen Finanzstatistiken lesen';
  END IF;

  RETURN QUERY
  SELECT
    dr.id,
    btrim(dr.last_name || ', ' || dr.first_name) AS label,
    count(*)::bigint AS ride_count
  FROM public.rides r
  JOIN public.drivers dr ON dr.id = r.driver_id
  WHERE r.status = 'completed'
    AND r.is_active = true
    AND r.driver_id IS NOT NULL
    AND r.date BETWEEN p_from AND p_to
  GROUP BY dr.id, dr.last_name, dr.first_name
  ORDER BY ride_count DESC, label ASC
  LIMIT GREATEST(p_limit, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.finance_dashboard_top_drivers(date, date, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_dashboard_top_drivers(date, date, int) TO authenticated;


-- -----------------------------------------------------------------------------
-- 5: finance_dashboard_receivable_count
--    Arbeitsvorrat: Anzahl quittierbarer Fahrten im Zeitraum — completed,
--    aktiv, bepreist und NICHT Teil einer aktiven (nicht-stornierten) Quittung.
--    Spiegelt exakt die Quittierbarkeits-Regel aus issue_receipt (20260720).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finance_dashboard_receivable_count(
  p_from date,
  p_to   date
)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_role  text;
  v_count bigint;
BEGIN
  v_role := public.get_user_role();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'operator') THEN
    RAISE EXCEPTION 'Nur Administratoren/Operatoren duerfen Finanzstatistiken lesen';
  END IF;

  SELECT count(*)::bigint
  INTO v_count
  FROM public.rides r
  WHERE r.status = 'completed'
    AND r.is_active = true
    AND r.date BETWEEN p_from AND p_to
    AND COALESCE(r.price_override, r.calculated_price) IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.receipt_items ri
      WHERE ri.ride_id = r.id
        AND ri.is_cancelled = false
    );

  RETURN COALESCE(v_count, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.finance_dashboard_receivable_count(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_dashboard_receivable_count(date, date) TO authenticated;
