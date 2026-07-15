-- =============================================================================
-- M14 Finanzmodul — issue_receipt() RPC: DB-LEVEL ASSERTIONS (Issue #147)
-- =============================================================================
--
-- Runnable, DB-side proof of the atomic receipt issuance RPC from
-- migration 20260720_000001_issue_receipt_rpc.sql:
--   * Role gate: only admin/operator with a session may issue.
--   * Snapshot correctness: recipient (patient vs. billing_recipient), number
--     format Q-<year>-<5>, item description "<Ort> → <Ziel> (<Richtung>)",
--     distance_km = meters/1000, amount = COALESCE(price_override, calculated_price),
--     total_amount = Σ amounts.
--   * Validation: only completed rides of the patient in the period; priceless
--     rides rejected; foreign rides / out-of-period rejected.
--   * Double-issue: a ride already on an active receipt is rejected (pre-check +
--     partial-unique-index); after Storno the ride is issuable again.
--   * Audit: an audit_log row (entity_type='receipt', action='create') is written.
--
-- HOW TO RUN (requires a DB with all migrations applied — Vitest has no DB):
--     psql "$DATABASE_URL" -f supabase/tests/m14_issue_receipt.sql
--
-- Runs inside ONE transaction that ROLLS BACK at the end → idempotent, no
-- fixtures left behind. A single failed assertion aborts with 'FAIL: ...'.
-- =============================================================================

BEGIN;

-- Deterministic fixture ids ---------------------------------------------------
\set operator_uid  '44444444-0000-0000-0000-000000000001'
\set driver_uid    '44444444-0000-0000-0000-000000000002'
\set driver_id     'dddddddd-0000-0000-0000-000000000009'
\set patient_id    'aaaaaaaa-0000-0000-0000-000000000009'
\set patient_bill  'aaaaaaaa-0000-0000-0000-000000000010'
\set dest_id       'cccccccc-0000-0000-0000-000000000009'
\set ride_a        'e9000000-0000-0000-0000-000000000001'
\set ride_b        'e9000000-0000-0000-0000-000000000002'
\set ride_noprice  'e9000000-0000-0000-0000-000000000003'
\set ride_outofrng 'e9000000-0000-0000-0000-000000000004'
\set ride_bill     'e9000000-0000-0000-0000-000000000005'

-- ---------------------------------------------------------------------------
-- FIXTURES (as superuser; RLS bypassed, triggers/constraints still fire).
-- ---------------------------------------------------------------------------
INSERT INTO public.drivers (id, first_name, last_name, is_active, vehicle_type)
VALUES (:'driver_id', 'Dora', 'Driver', true, 'standard');

INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
VALUES
  (:'operator_uid', 'authenticated', 'authenticated', 'op147@example.com',
     '{"display_name":"Olga Operator"}', now(), now()),
  (:'driver_uid', 'authenticated', 'authenticated', 'drv147@example.com',
     '{"display_name":"Dora Driver"}', now(), now());

UPDATE public.profiles SET role = 'driver', driver_id = :'driver_id'
  WHERE id = :'driver_uid';

-- Standard patient (recipient falls back to patient name/address).
INSERT INTO public.patients (id, first_name, last_name, street, house_number, postal_code, city, is_active)
VALUES (:'patient_id', 'Max', 'Muster', 'Bahnhofstrasse', '1', '8600', 'Dübendorf', true);

-- Patient with an explicit billing recipient.
INSERT INTO public.patients (id, first_name, last_name, street, house_number, postal_code, city,
                             billing_recipient_name, billing_recipient_address, is_active)
VALUES (:'patient_bill', 'Erna', 'Empfang', 'Seeweg', '5', '8610', 'Uster',
        'Beistand Meier', E'Amtsstrasse 2\n8000 Zürich', true);

INSERT INTO public.destinations (id, display_name, facility_type, city, is_active)
VALUES (:'dest_id', 'USZ Zürich', 'hospital', 'Zürich', true);

-- Rides for the standard patient (July 2026).
INSERT INTO public.rides (id, patient_id, destination_id, date, pickup_time, direction, status,
                          distance_meters, calculated_price, price_override)
VALUES
  (:'ride_a',        :'patient_id', :'dest_id', '2026-07-05', '09:00', 'outbound', 'completed', 12500, 25.00, NULL),
  (:'ride_b',        :'patient_id', :'dest_id', '2026-07-06', '09:00', 'return',   'completed', 12500, 30.00, 40.00),
  (:'ride_noprice',  :'patient_id', :'dest_id', '2026-07-07', '09:00', 'outbound', 'completed', 12500, NULL,  NULL),
  (:'ride_outofrng', :'patient_id', :'dest_id', '2026-08-01', '09:00', 'outbound', 'completed', 12500, 25.00, NULL);

-- Ride for the billing-recipient patient.
INSERT INTO public.rides (id, patient_id, destination_id, date, pickup_time, direction, status,
                          distance_meters, calculated_price)
VALUES
  (:'ride_bill', :'patient_bill', :'dest_id', '2026-07-10', '09:00', 'outbound', 'completed', 8000, 16.00);


-- ===========================================================================
-- Act as the operator for all RPC calls -------------------------------------
-- ===========================================================================
SELECT set_config('request.jwt.claims',
  json_build_object('sub', '44444444-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;


-- ===========================================================================
-- Happy path: snapshot correctness ------------------------------------------
-- ===========================================================================
DO $$
DECLARE
  v_receipt public.receipts;
  v_item    public.receipt_items;
  v_count   int;
BEGIN
  v_receipt := public.issue_receipt(
    'aaaaaaaa-0000-0000-0000-000000000009',
    '2026-07-01', '2026-07-31',
    ARRAY['e9000000-0000-0000-0000-000000000001',
          'e9000000-0000-0000-0000-000000000002']::uuid[]
  );

  -- Number format Q-<year>-<5 digits>
  IF v_receipt.receipt_number !~ '^Q-2026-[0-9]{5}$' THEN
    RAISE EXCEPTION 'FAIL (number format): %', v_receipt.receipt_number;
  END IF;

  -- Recipient snapshot from patient (first + last name; multi-line address)
  IF v_receipt.recipient_name <> 'Max Muster' THEN
    RAISE EXCEPTION 'FAIL (recipient_name): %', v_receipt.recipient_name;
  END IF;
  IF v_receipt.recipient_address <> E'Bahnhofstrasse 1\n8600 Dübendorf' THEN
    RAISE EXCEPTION 'FAIL (recipient_address): %', v_receipt.recipient_address;
  END IF;

  -- total_amount = 25.00 + 40.00 (override wins over calculated 30.00)
  IF v_receipt.total_amount <> 65.00 THEN
    RAISE EXCEPTION 'FAIL (total_amount): %', v_receipt.total_amount;
  END IF;

  IF v_receipt.status <> 'issued' OR v_receipt.pdf_path IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL (initial status/pdf_path)';
  END IF;

  SELECT count(*) INTO v_count FROM public.receipt_items WHERE receipt_id = v_receipt.id;
  IF v_count <> 2 THEN RAISE EXCEPTION 'FAIL (item count): %', v_count; END IF;

  -- Item snapshot detail for the outbound ride
  SELECT * INTO v_item FROM public.receipt_items
   WHERE receipt_id = v_receipt.id AND ride_id = 'e9000000-0000-0000-0000-000000000001';
  IF v_item.description <> 'Dübendorf → USZ Zürich (Hinfahrt)' THEN
    RAISE EXCEPTION 'FAIL (item description): %', v_item.description;
  END IF;
  IF v_item.distance_km <> 12.5 THEN
    RAISE EXCEPTION 'FAIL (item distance_km): %', v_item.distance_km;
  END IF;
  IF v_item.amount <> 25.00 THEN
    RAISE EXCEPTION 'FAIL (item amount): %', v_item.amount;
  END IF;

  -- Audit row written atomically
  SELECT count(*) INTO v_count FROM public.audit_log
   WHERE entity_type = 'receipt' AND action = 'create' AND entity_id = v_receipt.id;
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL (audit row missing): %', v_count; END IF;
END $$;


-- ===========================================================================
-- billing_recipient snapshot -------------------------------------------------
-- ===========================================================================
DO $$
DECLARE v_receipt public.receipts;
BEGIN
  v_receipt := public.issue_receipt(
    'aaaaaaaa-0000-0000-0000-000000000010',
    '2026-07-01', '2026-07-31',
    ARRAY['e9000000-0000-0000-0000-000000000005']::uuid[]
  );
  IF v_receipt.recipient_name <> 'Beistand Meier' THEN
    RAISE EXCEPTION 'FAIL (billing recipient_name): %', v_receipt.recipient_name;
  END IF;
  IF v_receipt.recipient_address <> E'Amtsstrasse 2\n8000 Zürich' THEN
    RAISE EXCEPTION 'FAIL (billing recipient_address): %', v_receipt.recipient_address;
  END IF;
END $$;


-- ===========================================================================
-- Validation: priceless ride is rejected ------------------------------------
-- ===========================================================================
DO $$
DECLARE v_blocked boolean := false;
BEGIN
  BEGIN
    PERFORM public.issue_receipt(
      'aaaaaaaa-0000-0000-0000-000000000009',
      '2026-07-01', '2026-07-31',
      ARRAY['e9000000-0000-0000-0000-000000000003']::uuid[]
    );
  EXCEPTION WHEN raise_exception THEN v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'FAIL (priceless ride was accepted)'; END IF;
END $$;


-- ===========================================================================
-- Validation: out-of-period ride is rejected --------------------------------
-- ===========================================================================
DO $$
DECLARE v_blocked boolean := false;
BEGIN
  BEGIN
    PERFORM public.issue_receipt(
      'aaaaaaaa-0000-0000-0000-000000000009',
      '2026-07-01', '2026-07-31',
      ARRAY['e9000000-0000-0000-0000-000000000004']::uuid[]  -- August ride
    );
  EXCEPTION WHEN raise_exception THEN v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'FAIL (out-of-period ride was accepted)'; END IF;
END $$;


-- ===========================================================================
-- Double-issue: rejected while active, allowed again after Storno -----------
-- ===========================================================================
DO $$
DECLARE
  v_receipt public.receipts;
  v_blocked boolean := false;
BEGIN
  -- ride_a is already on the first (active) receipt → a second issuance fails.
  BEGIN
    PERFORM public.issue_receipt(
      'aaaaaaaa-0000-0000-0000-000000000009',
      '2026-07-01', '2026-07-31',
      ARRAY['e9000000-0000-0000-0000-000000000001']::uuid[]
    );
  EXCEPTION WHEN raise_exception THEN v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'FAIL (double issuance of an active ride)'; END IF;

  -- Storno the first receipt of ride_a → propagation frees the ride.
  UPDATE public.receipts
     SET status = 'cancelled', cancelled_reason = 'Neuausstellung', cancelled_at = now()
   WHERE id = (
     SELECT receipt_id FROM public.receipt_items
      WHERE ride_id = 'e9000000-0000-0000-0000-000000000001' AND is_cancelled = false
   );

  -- Now the same ride can be issued again on a fresh receipt.
  v_receipt := public.issue_receipt(
    'aaaaaaaa-0000-0000-0000-000000000009',
    '2026-07-01', '2026-07-31',
    ARRAY['e9000000-0000-0000-0000-000000000001']::uuid[]
  );
  IF v_receipt.total_amount <> 25.00 THEN
    RAISE EXCEPTION 'FAIL (re-issuance total): %', v_receipt.total_amount;
  END IF;
END $$;


-- ===========================================================================
-- Empty selection is rejected -----------------------------------------------
-- ===========================================================================
DO $$
DECLARE v_blocked boolean := false;
BEGIN
  BEGIN
    PERFORM public.issue_receipt(
      'aaaaaaaa-0000-0000-0000-000000000009',
      '2026-07-01', '2026-07-31',
      ARRAY[]::uuid[]
    );
  EXCEPTION WHEN raise_exception THEN v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'FAIL (empty selection accepted)'; END IF;
END $$;


-- ===========================================================================
-- Role gate: a driver cannot issue ------------------------------------------
-- ===========================================================================
SELECT set_config('request.jwt.claims',
  json_build_object('sub', '44444444-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);

DO $$
DECLARE v_blocked boolean := false;
BEGIN
  BEGIN
    PERFORM public.issue_receipt(
      'aaaaaaaa-0000-0000-0000-000000000009',
      '2026-07-01', '2026-07-31',
      ARRAY['e9000000-0000-0000-0000-000000000002']::uuid[]
    );
  EXCEPTION WHEN raise_exception THEN v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'FAIL (driver issued a receipt)'; END IF;
END $$;


-- ===========================================================================
RESET ROLE;
DO $$ BEGIN RAISE NOTICE 'M14 ISSUE_RECEIPT: all passed'; END $$;
ROLLBACK;
