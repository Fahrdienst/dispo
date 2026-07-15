-- =============================================================================
-- Migration: Finanzmodul (M14) — Quittungs-Ausstellung RPC (Issue #147)
-- =============================================================================
-- Atomare Ausstellung einer Zahlungsbestaetigung in EINER Transaktion:
--   1. Nummer ziehen (next_receipt_number, atomarer Upsert)
--   2. Empfaenger-Snapshot aus patients (bzw. billing_recipient_*) erstellen
--   3. receipts + receipt_items (Snapshot der Fahrtdaten) schreiben
--   4. Audit-Eintrag (SEC-M14-006) im selben Transaktions-Kontext
--
-- Referenzen:
--   * docs/finanzmodul-konzept.md, Abschnitt 3.1 + 4.1
--   * docs/adrs/015-finance-module.md, Entscheide E2/E4/E5
--   * docs/security/004-finance-module-review.md, SEC-M14-002/006
--
-- Transaktions-Grenze (ADR-015 E5): Diese RPC schreibt ausschliesslich in die DB.
-- Die PDF-Erzeugung + der Storage-Upload passieren DANACH in der Server Action
-- (ausserhalb der DB-Transaktion). Scheitert das PDF, bleibt der Beleg mit
-- pdf_path NULL bestehen und wird per idempotenter Retry-Aktion nachgezogen.
--
-- Sicherheits-Kernpunkte:
--   * Rollen-Gate: nur admin/operator mit gueltiger Session (analog
--     next_receipt_number). Fahrer/anon werden abgewiesen.
--   * SECURITY DEFINER umgeht RLS fuer die INSERTs, aber die Immutability-Trigger
--     aus 20260718 feuern weiterhin (Defense-in-Depth).
--   * Nummernvergabe im selben Statement: Rollback (z.B. Race auf dem
--     Partial-Unique-Index) gibt die Nummer wieder frei → keine Luecken.
-- =============================================================================


CREATE OR REPLACE FUNCTION public.issue_receipt(
  p_patient_id  uuid,
  p_period_from date,
  p_period_to   date,
  p_ride_ids    uuid[]
)
RETURNS public.receipts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role       text;
  v_issuer     uuid;
  v_patient    public.patients%ROWTYPE;
  v_rcpt_name  text;
  v_rcpt_addr  text;
  v_ids        uuid[];
  v_expected   int;
  v_matched    int;
  v_year       int;
  v_num        int;
  v_number     text;
  v_total      numeric(10,2);
  v_receipt    public.receipts%ROWTYPE;
BEGIN
  -- --- Rollen-Gate (nur admin/operator mit gueltiger Session) ---------------
  v_role := public.get_user_role();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'operator') THEN
    RAISE EXCEPTION 'Nur Administratoren/Operatoren duerfen Quittungen ausstellen';
  END IF;

  v_issuer := auth.uid();
  IF v_issuer IS NULL THEN
    RAISE EXCEPTION 'Kein authentifizierter Benutzer';
  END IF;

  -- --- Argument-Validierung -------------------------------------------------
  IF p_period_from IS NULL OR p_period_to IS NULL OR p_period_to < p_period_from THEN
    RAISE EXCEPTION 'Ungueltiger Zeitraum';
  END IF;

  -- Duplikate im Eingabe-Array entfernen und NULLs verwerfen.
  v_ids := ARRAY(
    SELECT DISTINCT x
    FROM unnest(COALESCE(p_ride_ids, '{}'::uuid[])) AS x
    WHERE x IS NOT NULL
  );
  v_expected := COALESCE(array_length(v_ids, 1), 0);
  IF v_expected = 0 THEN
    RAISE EXCEPTION 'Keine Fahrten ausgewaehlt';
  END IF;

  -- --- Patient + Empfaenger-Snapshot ----------------------------------------
  SELECT * INTO v_patient FROM public.patients WHERE id = p_patient_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Patient nicht gefunden';
  END IF;

  IF v_patient.billing_recipient_name IS NOT NULL
     AND btrim(v_patient.billing_recipient_name) <> '' THEN
    -- Abweichender Rechnungsempfaenger (SEC-M14-008: Rechtsgrundlage im Prozess).
    v_rcpt_name := btrim(v_patient.billing_recipient_name);
    v_rcpt_addr := COALESCE(
      NULLIF(btrim(v_patient.billing_recipient_address), ''),
      concat_ws(
        E'\n',
        NULLIF(btrim(concat_ws(' ', v_patient.street, v_patient.house_number)), ''),
        NULLIF(btrim(concat_ws(' ', v_patient.postal_code, v_patient.city)), '')
      )
    );
  ELSE
    v_rcpt_name := btrim(v_patient.first_name || ' ' || v_patient.last_name);
    v_rcpt_addr := concat_ws(
      E'\n',
      NULLIF(btrim(concat_ws(' ', v_patient.street, v_patient.house_number)), ''),
      NULLIF(btrim(concat_ws(' ', v_patient.postal_code, v_patient.city)), '')
    );
  END IF;

  -- recipient_address ist NOT NULL: Beleg bleibt auch ohne Adresse ausstellbar.
  IF v_rcpt_addr IS NULL OR btrim(v_rcpt_addr) = '' THEN
    v_rcpt_addr := '-';
  END IF;

  -- --- Fahrten validieren ---------------------------------------------------
  -- Nur completed-Fahrten des Patienten im Zeitraum sind quittierbar.
  SELECT count(*) INTO v_matched
  FROM public.rides r
  WHERE r.id = ANY(v_ids)
    AND r.patient_id = p_patient_id
    AND r.status = 'completed'
    AND r.is_active = true
    AND r.date BETWEEN p_period_from AND p_period_to;

  IF v_matched <> v_expected THEN
    RAISE EXCEPTION 'Einige Fahrten sind nicht quittierbar (nicht abgeschlossen, ausserhalb des Zeitraums oder gehoeren nicht zum Patienten)';
  END IF;

  -- Fahrten ohne Preis koennen nicht quittiert werden (amount ist NOT NULL).
  IF EXISTS (
    SELECT 1 FROM public.rides r
    WHERE r.id = ANY(v_ids)
      AND COALESCE(r.price_override, r.calculated_price) IS NULL
  ) THEN
    RAISE EXCEPTION 'Mindestens eine Fahrt hat keinen Preis und kann nicht quittiert werden';
  END IF;

  -- Vorpruefung Doppel-Quittierung (freundliche Meldung). Der Partial-Unique-
  -- Index uq_receipt_items_active_ride ist die race-freie Durchsetzung (siehe
  -- EXCEPTION-Block unten).
  IF EXISTS (
    SELECT 1 FROM public.receipt_items ri
    WHERE ri.ride_id = ANY(v_ids)
      AND ri.is_cancelled = false
  ) THEN
    RAISE EXCEPTION 'Mindestens eine Fahrt ist bereits Teil einer aktiven Quittung';
  END IF;

  -- --- Summe berechnen ------------------------------------------------------
  SELECT COALESCE(SUM(COALESCE(r.price_override, r.calculated_price)), 0)::numeric(10,2)
  INTO v_total
  FROM public.rides r
  WHERE r.id = ANY(v_ids);

  -- --- Nummer ziehen (atomar, im selben Transaktions-Kontext) ---------------
  v_year   := date_part('year', now())::int;
  v_num    := public.next_receipt_number(v_year);
  v_number := 'Q-' || v_year::text || '-' || lpad(v_num::text, 5, '0');

  -- --- Beleg-Kopf schreiben -------------------------------------------------
  INSERT INTO public.receipts (
    receipt_number, patient_id, recipient_name, recipient_address,
    period_from, period_to, total_amount, issued_by
  )
  VALUES (
    v_number, p_patient_id, v_rcpt_name, v_rcpt_addr,
    p_period_from, p_period_to, v_total, v_issuer
  )
  RETURNING * INTO v_receipt;

  -- --- Positionen schreiben (Snapshot) --------------------------------------
  -- description: '<Ort> → <Ziel> (<Richtung>)'. Der Partial-Unique-Index kann
  -- bei Nebenlaeufigkeit hier eine unique_violation werfen → freundliche Meldung
  -- (das Re-RAISE rollt die gesamte aeussere Transaktion zurueck, inkl. der
  -- gezogenen Nummer → keine Luecke).
  BEGIN
    INSERT INTO public.receipt_items (
      receipt_id, ride_id, ride_date, description, distance_km, amount
    )
    SELECT
      v_receipt.id,
      r.id,
      r.date,
      concat_ws(
        ' ',
        concat_ws(' → ', COALESCE(NULLIF(btrim(p.city), ''), 'Start'), d.display_name),
        '(' || CASE r.direction
                 WHEN 'outbound' THEN 'Hinfahrt'
                 WHEN 'return'   THEN 'Rückfahrt'
                 WHEN 'both'     THEN 'Hin & Rück'
                 ELSE r.direction::text
               END || ')'
      ),
      CASE
        WHEN r.distance_meters IS NOT NULL
        THEN round(r.distance_meters::numeric / 1000, 1)
        ELSE NULL
      END,
      COALESCE(r.price_override, r.calculated_price)
    FROM public.rides r
    JOIN public.patients p     ON p.id = r.patient_id
    JOIN public.destinations d ON d.id = r.destination_id
    WHERE r.id = ANY(v_ids);
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'Mindestens eine Fahrt ist bereits Teil einer aktiven Quittung';
  END;

  -- --- Audit (SEC-M14-006), atomar mit der Ausstellung ----------------------
  INSERT INTO public.audit_log (
    user_id, user_role, action, entity_type, entity_id, metadata
  )
  VALUES (
    v_issuer, v_role, 'create', 'receipt', v_receipt.id,
    jsonb_build_object(
      'receipt_number', v_number,
      'patient_id',     p_patient_id,
      'total_amount',   v_total,
      'item_count',     v_expected,
      'period_from',    p_period_from,
      'period_to',      p_period_to
    )
  );

  RETURN v_receipt;
END;
$$;

-- Zugriffsschutz analog next_receipt_number: nur authenticated (Rollen-Gate in
-- der Funktion) bzw. service_role duerfen ausfuehren.
REVOKE ALL ON FUNCTION public.issue_receipt(uuid, date, date, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_receipt(uuid, date, date, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_receipt(uuid, date, date, uuid[]) TO service_role;
