-- =============================================================================
-- Migration: Finanzmodul (M14) — Quittungs-Kern (Issue #143)
-- =============================================================================
-- Datenmodell fuer formale, revisionsfaehige Zahlungsbestaetigungen (Quittungen).
--
-- Referenzen:
--   * docs/finanzmodul-konzept.md, Abschnitt 3.1 + 8
--   * docs/adrs/015-finance-module.md, Entscheide E1–E5
--   * docs/security/004-finance-module-review.md, SEC-M14-001..003
--
-- Sicherheits-Kernpunkte (verbindlich, CRITICAL):
--   * SEC-M14-001: Unveraenderlichkeit. Kein direktes UPDATE/DELETE fuer
--     authenticated (kein permissives Policy → Default-Deny, analog audit_log),
--     zusaetzlich BEFORE-Trigger als Defense-in-Depth.
--   * SEC-M14-002: Nummernkreis atomar via SECURITY DEFINER-RPC; receipt_counters
--     RLS deny-all (Zugriff nur ueber die RPC).
--   * SEC-M14-003: anonymize_patient() kappt receipts.patient_id, laesst den
--     Snapshot unangetastet (OR Art. 958f Aufbewahrung).
-- =============================================================================


-- =============================================================================
-- 1. ENUM
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'receipt_status') THEN
    CREATE TYPE public.receipt_status AS ENUM ('issued', 'cancelled');
  END IF;
END $$;


-- =============================================================================
-- 2. TABELLEN
-- =============================================================================

-- Quittung (Kopf) — der Snapshot friert Empfaenger + Summe zum Ausstellungs-
-- zeitpunkt ein und ueberlebt Anonymisierung/Aenderung der Quell-Entitaeten.
CREATE TABLE IF NOT EXISTS public.receipts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number    text NOT NULL UNIQUE,                       -- 'Q-2026-00042'
  patient_id        uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  -- Snapshot des Empfaengers (ueberlebt Anonymisierung/Aenderung):
  recipient_name    text NOT NULL,
  recipient_address text NOT NULL,
  period_from       date NOT NULL,
  period_to         date NOT NULL,
  total_amount      numeric(10,2) NOT NULL,
  currency          text NOT NULL DEFAULT 'CHF',
  status            public.receipt_status NOT NULL DEFAULT 'issued',
  cancelled_reason  text,
  cancelled_at      timestamptz,
  pdf_path          text,                     -- receipts/<year>/<number>.pdf
  issued_by         uuid NOT NULL REFERENCES public.profiles(id),
  issued_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cancelled_needs_reason
    CHECK (status <> 'cancelled' OR cancelled_reason IS NOT NULL),
  CONSTRAINT period_valid
    CHECK (period_to >= period_from)
);

COMMENT ON TABLE public.receipts IS
  'Formale Zahlungsbestaetigungen (Quittungen). Unveraenderlich nach Ausstellung (Trigger). Aufbewahrung OR Art. 958f (10 Jahre).';
COMMENT ON COLUMN public.receipts.patient_id IS
  'FK zum Patienten; wird bei DSGVO-Anonymisierung auf NULL gekappt (Snapshot bleibt). ON DELETE SET NULL.';
COMMENT ON COLUMN public.receipts.pdf_path IS
  'Pfad im privaten Storage-Bucket receipts; NULL solange PDF (noch) nicht erzeugt wurde.';

-- Quittungs-Position (Zeile) — Snapshot der Fahrtdaten bei Ausstellung.
CREATE TABLE IF NOT EXISTS public.receipt_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id    uuid NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  ride_id       uuid REFERENCES public.rides(id) ON DELETE SET NULL,
  -- Denormalisiertes Storno-Flag, vom Eltern-Beleg gespiegelt (siehe Trigger).
  -- Ein Partial-Index-Praedikat darf nur eigene Spalten referenzieren, daher
  -- kann receipts.status hier nicht direkt genutzt werden (ADR-015 E4).
  is_cancelled  boolean NOT NULL DEFAULT false,
  ride_date     date NOT NULL,
  description   text NOT NULL,           -- z.B. 'Duebendorf → USZ Zuerich (Hinfahrt)'
  distance_km   numeric(7,1),
  amount        numeric(8,2) NOT NULL
);

COMMENT ON TABLE public.receipt_items IS
  'Positionen einer Quittung (Snapshot der Fahrtdaten). is_cancelled spiegelt den Beleg-Status (Trigger-gepflegt).';

-- Nummernkreis-Zaehler (eine Zeile pro Jahr). NUR ueber next_receipt_number()
-- beschreibbar (RLS deny-all).
CREATE TABLE IF NOT EXISTS public.receipt_counters (
  year        int PRIMARY KEY,
  last_number int NOT NULL DEFAULT 0
);

COMMENT ON TABLE public.receipt_counters IS
  'Fortlaufender Belegnummern-Zaehler pro Jahr. RLS deny-all: Zugriff ausschliesslich via next_receipt_number() (SECURITY DEFINER).';


-- =============================================================================
-- 3. INDEXE
-- =============================================================================

-- Eine Fahrt darf in hoechstens EINER nicht-stornierten Quittung stehen (ADR-015 E4).
CREATE UNIQUE INDEX IF NOT EXISTS uq_receipt_items_active_ride
  ON public.receipt_items (ride_id)
  WHERE is_cancelled = false AND ride_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt
  ON public.receipt_items (receipt_id);

CREATE INDEX IF NOT EXISTS idx_receipts_patient
  ON public.receipts (patient_id);

CREATE INDEX IF NOT EXISTS idx_receipts_issued_at
  ON public.receipts (issued_at DESC);


-- =============================================================================
-- 4. NUMMERNKREIS — SECURITY DEFINER RPC (SEC-M14-002, ADR-015 E2)
-- =============================================================================
-- Atomarer Upsert: ON CONFLICT DO UPDATE nimmt implizit den Row-Lock, parallele
-- Transaktionen serialisieren. Rollt die umgebende Transaktion zurueck, rollt
-- der Zaehler mit → keine Luecken, keine Duplikate. Sequenz pro Jahr.
--
-- Zugriffsschutz: session_user = 'service_role' (serverseitiger Admin-Client)
-- ODER get_user_role() IN ('admin','operator'). Ein Fahrer/anon kann keine
-- Nummer ziehen. Rueckgabe: die fortlaufende Ganzzahl (App formatiert 'Q-<Jahr>-<5-stellig>').

CREATE OR REPLACE FUNCTION public.next_receipt_number(p_year int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_num int;
BEGIN
  IF NOT (
    session_user = 'service_role'
    OR public.get_user_role() IN ('admin', 'operator')
  ) THEN
    RAISE EXCEPTION 'Nur Administratoren/Operatoren duerfen Belegnummern ziehen';
  END IF;

  INSERT INTO public.receipt_counters (year, last_number)
  VALUES (p_year, 1)
  ON CONFLICT (year)
    DO UPDATE SET last_number = public.receipt_counters.last_number + 1
  RETURNING last_number INTO v_num;

  RETURN v_num;
END;
$$;

REVOKE ALL ON FUNCTION public.next_receipt_number(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_receipt_number(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_receipt_number(int) TO service_role;


-- =============================================================================
-- 5. UNVERAENDERLICHKEIT — BEFORE-Trigger (SEC-M14-001, ADR-015 E3)
-- =============================================================================

-- receipts: UPDATE nur an {status, cancelled_reason, cancelled_at, pdf_path};
-- patient_id darf ausschliesslich auf NULL gekappt werden (Anonymisierung,
-- SEC-M14-003); DELETE stets blockiert.
CREATE OR REPLACE FUNCTION public.receipts_prevent_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Belege sind unveraenderlich und koennen nicht geloescht werden (OR Art. 958f). Storno statt Loeschung verwenden.';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.receipt_number IS DISTINCT FROM OLD.receipt_number
     -- patient_id darf nur GEKAPPT (auf NULL gesetzt), nie umgehaengt werden:
     OR (NEW.patient_id IS DISTINCT FROM OLD.patient_id AND NEW.patient_id IS NOT NULL)
     OR NEW.recipient_name IS DISTINCT FROM OLD.recipient_name
     OR NEW.recipient_address IS DISTINCT FROM OLD.recipient_address
     OR NEW.period_from IS DISTINCT FROM OLD.period_from
     OR NEW.period_to IS DISTINCT FROM OLD.period_to
     OR NEW.total_amount IS DISTINCT FROM OLD.total_amount
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.issued_by IS DISTINCT FROM OLD.issued_by
     OR NEW.issued_at IS DISTINCT FROM OLD.issued_at
  THEN
    RAISE EXCEPTION 'Ausgestellte Belege sind unveraenderlich: nur status/cancelled_reason/cancelled_at/pdf_path (bzw. patient_id → NULL) duerfen geaendert werden.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS receipts_no_update ON public.receipts;
CREATE TRIGGER receipts_no_update
  BEFORE UPDATE ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION public.receipts_prevent_mutation();

DROP TRIGGER IF EXISTS receipts_no_delete ON public.receipts;
CREATE TRIGGER receipts_no_delete
  BEFORE DELETE ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION public.receipts_prevent_mutation();


-- receipt_items: UPDATE nur is_cancelled false→true; ride_id darf (analog
-- patient_id) nur auf NULL gekappt werden (ON DELETE SET NULL der Fahrt);
-- DELETE stets blockiert. Ein receipts-DELETE tritt nie ein (siehe oben), daher
-- gibt es auch keinen CASCADE-Loeschpfad.
CREATE OR REPLACE FUNCTION public.receipt_items_prevent_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Beleg-Positionen sind unveraenderlich und koennen nicht geloescht werden (OR Art. 958f).';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.receipt_id IS DISTINCT FROM OLD.receipt_id
     OR (NEW.ride_id IS DISTINCT FROM OLD.ride_id AND NEW.ride_id IS NOT NULL)
     OR NEW.ride_date IS DISTINCT FROM OLD.ride_date
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.distance_km IS DISTINCT FROM OLD.distance_km
     OR NEW.amount IS DISTINCT FROM OLD.amount
     -- is_cancelled darf nur false→true (kein Wieder-Aktivieren):
     OR (OLD.is_cancelled = true AND NEW.is_cancelled = false)
  THEN
    RAISE EXCEPTION 'Beleg-Positionen sind unveraenderlich: nur der Storno-Uebergang (is_cancelled false→true) ist erlaubt.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS receipt_items_no_update ON public.receipt_items;
CREATE TRIGGER receipt_items_no_update
  BEFORE UPDATE ON public.receipt_items
  FOR EACH ROW EXECUTE FUNCTION public.receipt_items_prevent_mutation();

DROP TRIGGER IF EXISTS receipt_items_no_delete ON public.receipt_items;
CREATE TRIGGER receipt_items_no_delete
  BEFORE DELETE ON public.receipt_items
  FOR EACH ROW EXECUTE FUNCTION public.receipt_items_prevent_mutation();


-- =============================================================================
-- 6. STORNO-PROPAGATION — AFTER-Trigger (Konzept 3.1, ADR-015 E4)
-- =============================================================================
-- Bei status → 'cancelled' werden alle aktiven Positionen auf is_cancelled=true
-- gesetzt → die Fahrten werden dadurch wieder quittierbar (Partial-Unique-Index).
CREATE OR REPLACE FUNCTION public.receipts_propagate_cancellation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.receipt_items
     SET is_cancelled = true
   WHERE receipt_id = NEW.id
     AND is_cancelled = false;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS receipts_cancel_propagation ON public.receipts;
CREATE TRIGGER receipts_cancel_propagation
  AFTER UPDATE ON public.receipts
  FOR EACH ROW
  WHEN (OLD.status <> 'cancelled' AND NEW.status = 'cancelled')
  EXECUTE FUNCTION public.receipts_propagate_cancellation();


-- =============================================================================
-- 7. RLS (SEC-M14-001 / SEC-M14-007)
-- =============================================================================

ALTER TABLE public.receipts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_counters ENABLE ROW LEVEL SECURITY;

-- receipts: SELECT + INSERT nur admin/operator. KEIN UPDATE/DELETE-Policy →
-- Default-Deny (Storno/PDF-Pfad laeuft ueber den serverseitigen Admin-Client,
-- der RLS umgeht, aber weiterhin die Immutability-Trigger passiert).
CREATE POLICY receipts_select_staff ON public.receipts
  FOR SELECT USING (public.get_user_role() IN ('admin', 'operator'));

CREATE POLICY receipts_insert_staff ON public.receipts
  FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'operator'));

-- receipt_items: analog.
CREATE POLICY receipt_items_select_staff ON public.receipt_items
  FOR SELECT USING (public.get_user_role() IN ('admin', 'operator'));

CREATE POLICY receipt_items_insert_staff ON public.receipt_items
  FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'operator'));

-- receipt_counters: KEINE Policy → Default-Deny fuer anon/authenticated.
-- Zugriff ausschliesslich ueber next_receipt_number() (SECURITY DEFINER) bzw.
-- den service_role-Key (umgeht RLS).


-- =============================================================================
-- 8. STORAGE-BUCKET (privat, SEC-M14-005/007/012)
-- =============================================================================
-- Privater Bucket nach feedback-Muster (Migration 20260323): public=false und
-- BEWUSST KEINE Policy, die den Bucket referenziert → Default-Deny fuer
-- anon/authenticated. Zugriff nur via service_role + kurzlebige signierte URLs
-- (TTL <= 5 min, in 14.2) aus Server Actions. KEINE breite FOR ALL-Policy
-- anlegen (wuerde alle Buckets oeffnen).
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- 9. ANONYMISIERUNG — Referenz kappen, Snapshot schuetzen (SEC-M14-003)
-- =============================================================================
-- WICHTIG (OR Art. 958f): Eine Zahlungsbestaetigung ist ein Buchungsbeleg mit
-- 10-jaehriger, unveraenderbarer Aufbewahrungspflicht. Der Anonymisierungsjob
-- (DSGVO Art. 17) darf den Beleg-Snapshot (recipient_name/-address, alle
-- receipt_items) NIEMALS leeren — das Loeschrecht ist durch Art. 17 Abs. 3 lit. b
-- ueberlagert. Wir kappen ausschliesslich die Fremdschluessel-Bruecke
-- (receipts.patient_id → NULL), damit nach einem Erasure-Request keine
-- Re-Assoziation ueber patient_id mehr moeglich ist. receipt_items wird NICHT
-- angefasst. Regressionsschutz: supabase/tests/m14_receipts.sql.
CREATE OR REPLACE FUNCTION anonymize_patient(p_patient_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check for active rides
    IF EXISTS (
        SELECT 1 FROM rides
        WHERE patient_id = p_patient_id
        AND status NOT IN ('completed', 'cancelled', 'no_show')
        AND is_active = true
    ) THEN
        RAISE EXCEPTION 'Patient hat noch aktive Fahrten und kann nicht anonymisiert werden';
    END IF;

    -- Anonymize personal data
    UPDATE patients SET
        first_name = 'ANONYMISIERT',
        last_name = 'ANONYMISIERT',
        phone = NULL,
        street = NULL,
        house_number = NULL,
        postal_code = LEFT(postal_code, 2) || '00',  -- Reduce to region for statistics
        city = city,  -- Keep city for statistics
        notes = NULL,
        comment = NULL,
        emergency_contact_name = NULL,
        emergency_contact_phone = NULL,
        formatted_address = NULL,
        lat = NULL,
        lng = NULL,
        place_id = NULL,
        geocode_status = 'none',
        geocode_updated_at = NULL,
        is_active = false,
        updated_at = NOW()
    WHERE id = p_patient_id;

    -- Remove impairments (personal health data)
    DELETE FROM patient_impairments WHERE patient_id = p_patient_id;

    -- Deactivate associated ride series
    UPDATE ride_series SET
        is_active = false,
        notes = NULL,
        updated_at = NOW()
    WHERE patient_id = p_patient_id;

    -- Anonymize communication log entries
    UPDATE communication_log SET
        message = '[Anonymisiert gemaess DSGVO Art. 17]'
    WHERE ride_id IN (SELECT id FROM rides WHERE patient_id = p_patient_id);

    -- SEC-M14-003: Kappe die FK-Bruecke zu Belegen, ohne den aufbewahrungs-
    -- pflichtigen Snapshot zu veraendern (OR Art. 958f, siehe Kommentar oben).
    UPDATE receipts SET patient_id = NULL WHERE patient_id = p_patient_id;
END;
$$;

REVOKE ALL ON FUNCTION anonymize_patient(UUID) FROM PUBLIC;
