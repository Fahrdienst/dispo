-- =============================================================================
-- M14 Finanzmodul — Quittungs-Kern: DB-LEVEL ASSERTIONS (Issue #143)
-- =============================================================================
--
-- Runnable, DB-side proof of the CRITICAL guarantees from
-- docs/security/004-finance-module-review.md:
--   * SEC-M14-001  Immutability of issued receipts/items (triggers + no UPDATE/
--                  DELETE policy). Correction = Storno, never edit/delete.
--   * SEC-M14-002  Atomic, gap-free receipt numbering; counter not client-writable;
--                  role-gated; rollback releases the number.
--   * SEC-M14-003  anonymize_patient() caps receipts.patient_id → NULL but leaves
--                  the snapshot (recipient_name/-address, receipt_items) intact
--                  (OR Art. 958f retention). REGRESSION GUARD.
--   * ADR-015 E4   Partial-unique-index: a ride is on at most one ACTIVE receipt;
--                  Storno frees it again (propagation trigger).
--
-- HOW TO RUN (requires a DB with all migrations applied — Vitest has no DB, so
-- this is a DB-side / manual assertion, NOT part of `npm test`):
--
--     psql "$DATABASE_URL" -f supabase/tests/m14_receipts.sql
--     # or:  supabase db execute --file supabase/tests/m14_receipts.sql
--
-- The whole script runs inside ONE transaction that ROLLS BACK at the end, so it
-- is fully IDEMPOTENT and leaves no fixtures behind. A single failed assertion
-- aborts with a clear 'FAIL: ...'; a clean run prints 'M14 RECEIPTS: all passed'.
-- =============================================================================

BEGIN;

-- Deterministic fixture ids ---------------------------------------------------
\set operator_uid  '33333333-0000-0000-0000-000000000001'
\set driver_uid    '33333333-0000-0000-0000-000000000002'
\set driver_id     'dddddddd-0000-0000-0000-000000000002'
\set patient_id    'aaaaaaaa-0000-0000-0000-000000000001'
\set dest_id       'cccccccc-0000-0000-0000-000000000001'
\set ride_imm      'e0000000-0000-0000-0000-000000000001'
\set ride_idx      'e0000000-0000-0000-0000-000000000002'
\set ride_anon     'e0000000-0000-0000-0000-000000000003'
\set r_imm         'f0000000-0000-0000-0000-000000000001'
\set r_idx1        'f0000000-0000-0000-0000-000000000002'
\set r_idx2        'f0000000-0000-0000-0000-000000000003'
\set r_anon        'f0000000-0000-0000-0000-000000000004'

-- ---------------------------------------------------------------------------
-- FIXTURES (as superuser; RLS bypassed, but triggers/constraints still fire).
-- ---------------------------------------------------------------------------
INSERT INTO public.drivers (id, first_name, last_name, is_active, vehicle_type)
VALUES (:'driver_id', 'Dora', 'Driver', true, 'standard');

INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
VALUES
  (:'operator_uid', 'authenticated', 'authenticated', 'op14@example.com',
     '{"display_name":"Olga Operator"}', now(), now()),
  (:'driver_uid', 'authenticated', 'authenticated', 'drv14@example.com',
     '{"display_name":"Dora Driver"}', now(), now());

-- handle_new_user() created both profiles defaulted to 'operator'. Promote the
-- driver (what inviteDriver() does) and leave the operator as-is.
UPDATE public.profiles SET role = 'driver', driver_id = :'driver_id'
  WHERE id = :'driver_uid';

INSERT INTO public.patients (id, first_name, last_name, postal_code, city, is_active)
VALUES (:'patient_id', 'Max', 'Muster', '8600', 'Duebendorf', true);

INSERT INTO public.destinations (id, name, type, is_active)
VALUES (:'dest_id', 'USZ Zuerich', 'hospital', true);

INSERT INTO public.rides (id, patient_id, destination_id, date, pickup_time, direction, status)
VALUES
  (:'ride_imm',  :'patient_id', :'dest_id', '2026-07-05', '09:00', 'outbound', 'completed'),
  (:'ride_idx',  :'patient_id', :'dest_id', '2026-07-06', '09:00', 'outbound', 'completed'),
  (:'ride_anon', :'patient_id', :'dest_id', '2026-07-07', '09:00', 'outbound', 'completed');

-- Three independent receipts (distinct rides → no partial-index clash).
INSERT INTO public.receipts (id, receipt_number, patient_id, recipient_name, recipient_address, period_from, period_to, total_amount, issued_by)
VALUES
  (:'r_imm',  'Q-2026-90001', :'patient_id', 'Max Muster', 'Bahnhofstrasse 1, 8600 Duebendorf', '2026-07-01', '2026-07-31', 25.00, :'operator_uid'),
  (:'r_idx1', 'Q-2026-90002', :'patient_id', 'Max Muster', 'Bahnhofstrasse 1, 8600 Duebendorf', '2026-07-01', '2026-07-31', 25.00, :'operator_uid'),
  (:'r_anon', 'Q-2026-90004', :'patient_id', 'Max Muster', 'Bahnhofstrasse 1, 8600 Duebendorf', '2026-07-01', '2026-07-31', 25.00, :'operator_uid');

INSERT INTO public.receipt_items (receipt_id, ride_id, ride_date, description, distance_km, amount)
VALUES
  (:'r_imm',  :'ride_imm',  '2026-07-05', 'Duebendorf → USZ (Hinfahrt)', 12.5, 25.00),
  (:'r_idx1', :'ride_idx',  '2026-07-06', 'Duebendorf → USZ (Hinfahrt)', 12.5, 25.00),
  (:'r_anon', :'ride_anon', '2026-07-07', 'Duebendorf → USZ (Hinfahrt)', 12.5, 25.00);


-- ===========================================================================
-- SEC-M14-001: Immutability of receipts (frozen columns + DELETE) ------------
-- ===========================================================================
DO $$
DECLARE v_blocked boolean;
BEGIN
  -- (a) mutating a frozen column must RAISE
  v_blocked := false;
  BEGIN
    UPDATE public.receipts SET recipient_name = 'Hacker' WHERE id = 'f0000000-0000-0000-0000-000000000001';
  EXCEPTION WHEN raise_exception THEN v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'FAIL (SEC-M14-001a): recipient_name was mutable'; END IF;

  -- (b) mutating total_amount must RAISE
  v_blocked := false;
  BEGIN
    UPDATE public.receipts SET total_amount = 0.01 WHERE id = 'f0000000-0000-0000-0000-000000000001';
  EXCEPTION WHEN raise_exception THEN v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'FAIL (SEC-M14-001b): total_amount was mutable'; END IF;

  -- (c) DELETE must RAISE
  v_blocked := false;
  BEGIN
    DELETE FROM public.receipts WHERE id = 'f0000000-0000-0000-0000-000000000001';
  EXCEPTION WHEN raise_exception THEN v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'FAIL (SEC-M14-001c): receipt was deletable'; END IF;
END $$;

-- Immutability of receipt_items (frozen columns, DELETE, un-cancel) ----------
DO $$
DECLARE v_blocked boolean;
BEGIN
  v_blocked := false;
  BEGIN
    UPDATE public.receipt_items SET amount = 99.99 WHERE receipt_id = 'f0000000-0000-0000-0000-000000000001';
  EXCEPTION WHEN raise_exception THEN v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'FAIL (SEC-M14-001d): item amount was mutable'; END IF;

  v_blocked := false;
  BEGIN
    DELETE FROM public.receipt_items WHERE receipt_id = 'f0000000-0000-0000-0000-000000000001';
  EXCEPTION WHEN raise_exception THEN v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'FAIL (SEC-M14-001e): item was deletable'; END IF;
END $$;

-- Allowed: Storno transition + propagation to items -------------------------
DO $$
DECLARE v_active int;
BEGIN
  UPDATE public.receipts
     SET status = 'cancelled', cancelled_reason = 'Testkorrektur', cancelled_at = now()
   WHERE id = 'f0000000-0000-0000-0000-000000000001';

  SELECT count(*) INTO v_active
    FROM public.receipt_items
   WHERE receipt_id = 'f0000000-0000-0000-0000-000000000001' AND is_cancelled = false;
  IF v_active <> 0 THEN
    RAISE EXCEPTION 'FAIL (Storno propagation): % item(s) still active after cancel', v_active;
  END IF;

  -- Un-cancel of a now-cancelled item must RAISE
  DECLARE v_blocked boolean := false;
  BEGIN
    UPDATE public.receipt_items SET is_cancelled = false
     WHERE receipt_id = 'f0000000-0000-0000-0000-000000000001';
  EXCEPTION WHEN raise_exception THEN v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'FAIL (SEC-M14-001f): item was un-cancellable'; END IF;
END $$;


-- ===========================================================================
-- ADR-015 E4: one ride → at most one ACTIVE receipt; Storno frees it ---------
-- ===========================================================================
DO $$
DECLARE v_blocked boolean;
BEGIN
  -- r_idx1 already holds an active item for ride_idx. A second active item on
  -- the SAME ride (into r_idx2) must violate uq_receipt_items_active_ride.
  INSERT INTO public.receipts (id, receipt_number, patient_id, recipient_name, recipient_address, period_from, period_to, total_amount, issued_by)
  VALUES ('f0000000-0000-0000-0000-000000000003', 'Q-2026-90003', 'aaaaaaaa-0000-0000-0000-000000000001',
          'Max Muster', 'Bahnhofstrasse 1, 8600 Duebendorf', '2026-07-01', '2026-07-31', 25.00,
          '33333333-0000-0000-0000-000000000001');

  v_blocked := false;
  BEGIN
    INSERT INTO public.receipt_items (receipt_id, ride_id, ride_date, description, amount)
    VALUES ('f0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000002',
            '2026-07-06', 'Duebendorf → USZ (Duplikat)', 25.00);
  EXCEPTION WHEN unique_violation THEN v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'FAIL (E4a): a ride landed on two active receipts'; END IF;

  -- Cancel r_idx1 → propagation frees ride_idx → the same item now inserts.
  UPDATE public.receipts
     SET status = 'cancelled', cancelled_reason = 'Neuausstellung', cancelled_at = now()
   WHERE id = 'f0000000-0000-0000-0000-000000000002';

  INSERT INTO public.receipt_items (receipt_id, ride_id, ride_date, description, amount)
  VALUES ('f0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000002',
          '2026-07-06', 'Duebendorf → USZ (Neuausstellung)', 25.00);
END $$;


-- ===========================================================================
-- SEC-M14-003: Anonymization caps patient_id, snapshot survives (REGRESSION) -
-- ===========================================================================
DO $$
DECLARE
  v_patient    uuid;
  v_name       text;
  v_addr       text;
  v_item_count int;
BEGIN
  PERFORM anonymize_patient('aaaaaaaa-0000-0000-0000-000000000001');

  SELECT patient_id, recipient_name, recipient_address
    INTO v_patient, v_name, v_addr
    FROM public.receipts WHERE id = 'f0000000-0000-0000-0000-000000000004';

  IF v_patient IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL (SEC-M14-003a): receipts.patient_id was NOT capped after anonymization';
  END IF;
  IF v_name <> 'Max Muster' OR v_addr <> 'Bahnhofstrasse 1, 8600 Duebendorf' THEN
    RAISE EXCEPTION 'FAIL (SEC-M14-003b): receipt snapshot was destroyed (name=%, addr=%)', v_name, v_addr;
  END IF;

  SELECT count(*) INTO v_item_count
    FROM public.receipt_items WHERE receipt_id = 'f0000000-0000-0000-0000-000000000004';
  IF v_item_count <> 1 THEN
    RAISE EXCEPTION 'FAIL (SEC-M14-003c): receipt_items snapshot was touched (count=%)', v_item_count;
  END IF;
END $$;


-- ===========================================================================
-- SEC-M14-002: numbering — sequential, per-year, rollback-releasing ----------
-- ===========================================================================
SELECT set_config('request.jwt.claims',
  json_build_object('sub', '33333333-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE a int; b int; c int; y2 int;
BEGIN
  a := public.next_receipt_number(2099);
  b := public.next_receipt_number(2099);
  c := public.next_receipt_number(2099);
  IF NOT (a = 1 AND b = 2 AND c = 3) THEN
    RAISE EXCEPTION 'FAIL (SEC-M14-002a): numbering not sequential (% % %)', a, b, c;
  END IF;
  y2 := public.next_receipt_number(2100);
  IF y2 <> 1 THEN RAISE EXCEPTION 'FAIL (SEC-M14-002b): per-year sequence not isolated (%)', y2; END IF;
END $$;

-- Counter not client-writable (deny-all RLS) --------------------------------
DO $$
DECLARE v_rows int; v_blocked boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.receipt_counters (year, last_number) VALUES (2200, 50);
  EXCEPTION WHEN insufficient_privilege THEN v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'FAIL (SEC-M14-002c): authenticated inserted into receipt_counters'; END IF;

  UPDATE public.receipt_counters SET last_number = 999 WHERE year = 2099;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN RAISE EXCEPTION 'FAIL (SEC-M14-002d): authenticated updated receipt_counters (% rows)', v_rows; END IF;
END $$;

-- Rollback releases the number (no gap) -------------------------------------
DO $$ DECLARE n int; BEGIN n := public.next_receipt_number(2101); END $$;  -- = 1
SAVEPOINT sp_num;
DO $$
DECLARE n int; BEGIN
  n := public.next_receipt_number(2101);   -- = 2
  IF n <> 2 THEN RAISE EXCEPTION 'FAIL (SEC-M14-002e): expected 2, got %', n; END IF;
END $$;
ROLLBACK TO SAVEPOINT sp_num;
DO $$
DECLARE n int; BEGIN
  n := public.next_receipt_number(2101);   -- must be 2 again (rollback freed it)
  IF n <> 2 THEN RAISE EXCEPTION 'FAIL (SEC-M14-002f): rollback did not release the number (got %)', n; END IF;
END $$;


-- ===========================================================================
-- Role gate + RLS: a driver can neither draw a number nor read/insert receipts
-- ===========================================================================
SELECT set_config('request.jwt.claims',
  json_build_object('sub', '33333333-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);

DO $$
DECLARE n int; v_blocked boolean := false;
BEGIN
  BEGIN
    n := public.next_receipt_number(2300);
  EXCEPTION WHEN raise_exception THEN v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'FAIL (role gate): driver drew a receipt number (%)', n; END IF;
END $$;

DO $$
DECLARE v_count int; v_blocked boolean := false;
BEGIN
  SELECT count(*) INTO v_count FROM public.receipts;
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL (RLS): driver can read % receipts', v_count; END IF;

  BEGIN
    INSERT INTO public.receipts (receipt_number, recipient_name, recipient_address, period_from, period_to, total_amount, issued_by)
    VALUES ('Q-2026-99999', 'X', 'Y', '2026-07-01', '2026-07-31', 10.00, '33333333-0000-0000-0000-000000000002');
  EXCEPTION WHEN insufficient_privilege THEN v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'FAIL (RLS): driver inserted a receipt'; END IF;
END $$;


-- ===========================================================================
RESET ROLE;
DO $$ BEGIN RAISE NOTICE 'M14 RECEIPTS: all passed'; END $$;
ROLLBACK;
