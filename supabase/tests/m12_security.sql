-- =============================================================================
-- M12 Driver Self-Service — DB-LEVEL SECURITY ASSERTIONS (Issue #106)
-- =============================================================================
--
-- These are the RUNNABLE, DB-side counterparts to the five #106 security cases.
-- The Vitest suite pins the APPLICATION intent (that the server actions never
-- hand the DB a client-controlled driver identity, gate roles, and correct the
-- invited driver's role). This script proves the actual RLS + SECURITY DEFINER
-- RPC GUARANTEES that make those actions safe even against a direct PostgREST /
-- psql attacker who bypasses the app entirely.
--
-- WHAT RUNS WHERE (honest coverage split):
--   Fall 1 (no foreign-driver absence)          -> DB here  (Vitest proxy: absences.test.ts)
--   Fall 2 (driver cannot approve)              -> DB here  (Vitest proxy: absences.test.ts)
--   Fall 3 (no is_active / vehicle_type change) -> DB here  (Vitest proxy: driver-self.test.ts)
--   Fall 4 (no re-home availability driver_id)  -> DB here  (WITH CHECK, this file)
--   Fall 5 (invited driver = role 'driver')     -> Vitest   (driver-invite.test.ts, the real test)
--                                                  DB here only asserts the PREMISE
--                                                  (fresh trigger profile defaults to 'operator',
--                                                   which is exactly why the app must correct it).
--
-- HOW TO RUN (requires a DB with all migrations applied — Vitest has no DB, so
-- this is a DB-side / manual assertion, NOT part of `npm test`):
--
--     psql "$DATABASE_URL" -f supabase/tests/m12_security.sql
--     # or:  supabase db execute --file supabase/tests/m12_security.sql
--
-- The whole script runs inside ONE transaction that ROLLS BACK at the end, so it
-- is fully IDEMPOTENT and leaves no fixtures behind. A single failed assertion
-- aborts the transaction with a clear 'SECURITY FAIL: ...' message; a clean run
-- prints 'M12 SECURITY: all DB assertions passed'.
--
-- Identity simulation: we set `request.jwt.claims` (so auth.uid() resolves) and
-- `SET LOCAL ROLE authenticated` (so RLS is enforced exactly as for a real user).
-- Fixtures are created as the superuser role, then we drop into `authenticated`.
-- =============================================================================

BEGIN;

-- Deterministic fixture ids ---------------------------------------------------
--   Two drivers (A = the attacker's own, B = the victim), one operator.
\set driver_a_uid  '11111111-1111-1111-1111-111111111111'
\set driver_b_uid  '22222222-2222-2222-2222-222222222222'
\set operator_uid  '33333333-3333-3333-3333-333333333333'
\set driver_a_id   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
\set driver_b_id   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

-- ---------------------------------------------------------------------------
-- FIXTURES (as superuser). Inserting into auth.users fires handle_new_user(),
-- which auto-creates a profile defaulted to role='operator'.
-- ---------------------------------------------------------------------------

INSERT INTO public.drivers (id, first_name, last_name, is_active, vehicle_type)
VALUES
  (:'driver_a_id', 'Anna', 'Attacker', true, 'standard'),
  (:'driver_b_id', 'Bertha', 'Victim',  true, 'standard');

INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
VALUES
  (:'driver_a_uid', 'authenticated', 'authenticated', 'anna@example.com',
     '{"display_name":"Anna Attacker"}', now(), now()),
  (:'driver_b_uid', 'authenticated', 'authenticated', 'bertha@example.com',
     '{"display_name":"Bertha Victim"}', now(), now()),
  (:'operator_uid', 'authenticated', 'authenticated', 'op@example.com',
     '{"display_name":"Otto Operator"}', now(), now());

-- ---------------------------------------------------------------------------
-- FALL 5 (PREMISE): the trigger-created profile defaults to role='operator'.
-- This is precisely why inviteDriver() MUST correct it (the real assertion for
-- Fall 5 lives in driver-invite.test.ts).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF (SELECT role FROM public.profiles WHERE id = '11111111-1111-1111-1111-111111111111')
       IS DISTINCT FROM 'operator' THEN
    RAISE EXCEPTION 'SECURITY FAIL (Fall 5 premise): fresh profile did not default to operator';
  END IF;
END $$;

-- Now promote the two driver profiles to role='driver' + link (what the app's
-- SEC-001 correction does), and keep the operator as-is.
UPDATE public.profiles SET role = 'driver', driver_id = :'driver_a_id'
  WHERE id = :'driver_a_uid';
UPDATE public.profiles SET role = 'driver', driver_id = :'driver_b_id'
  WHERE id = :'driver_b_uid';

-- A pre-existing availability row + absence owned by driver B, so the attacker
-- (driver A) has a concrete foreign target to try to hijack / approve.
INSERT INTO public.driver_availability (driver_id, day_of_week, start_time, end_time)
VALUES (:'driver_b_id', 'monday', '08:00', '10:00');

INSERT INTO public.driver_absences (driver_id, type, status, start_date, end_date)
VALUES (:'driver_b_id', 'vacation', 'requested', '2026-08-03', '2026-08-07');

-- =============================================================================
-- LOG IN AS DRIVER A (the attacker)
-- =============================================================================
SELECT set_config('request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text,
  true);
SET LOCAL ROLE authenticated;

-- ---------------------------------------------------------------------------
-- FALL 1: a driver cannot file an absence for a FOREIGN driver_id.
--   (a) Direct INSERT with driver B's id -> absences_insert_own WITH CHECK
--       requires driver_id = get_user_driver_id() -> must RAISE.
--   (b) The request_absence() RPC ignores any client driver_id and files for
--       the caller -> the created row must belong to driver A, never B.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  BEGIN
    INSERT INTO public.driver_absences (driver_id, type, status, start_date, end_date)
    VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'vacation', 'requested',
            '2026-09-01', '2026-09-02');
    RAISE EXCEPTION 'SECURITY FAIL (Fall 1a): driver A inserted an absence for driver B';
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN NULL; -- expected: RLS blocked it
  END;
END $$;

DO $$
DECLARE
  v_new_id   uuid;
  v_owner    uuid;
BEGIN
  v_new_id := public.request_absence('training', '2026-10-05', '2026-10-06', NULL);
  SELECT driver_id INTO v_owner FROM public.driver_absences WHERE id = v_new_id;
  IF v_owner <> 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' THEN
    RAISE EXCEPTION 'SECURITY FAIL (Fall 1b): request_absence filed for % (expected driver A)', v_owner;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- FALL 2: a driver cannot approve an absence (own or foreign).
--   (a) decide_absence() role gate -> must RAISE for a driver caller.
--   (b) Direct UPDATE is denied: there is NO UPDATE policy on driver_absences,
--       so the write touches 0 rows and the status is unchanged.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_absence uuid;
BEGIN
  SELECT id INTO v_absence FROM public.driver_absences
   WHERE driver_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' LIMIT 1;
  BEGIN
    PERFORM public.decide_absence(v_absence, 'approved', NULL);
    RAISE EXCEPTION 'SECURITY FAIL (Fall 2a): driver approved an absence via decide_absence';
  EXCEPTION
    WHEN raise_exception THEN NULL; -- expected: "Only admin/operator may decide absences"
  END;
END $$;

DO $$
DECLARE
  v_rows int;
BEGIN
  UPDATE public.driver_absences SET status = 'approved'
   WHERE driver_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'SECURITY FAIL (Fall 2b): driver directly updated % absence row(s)', v_rows;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- FALL 3: a driver cannot change is_active or vehicle_type.
--   (a) update_own_driver_contact() only touches the six whitelisted columns;
--       is_active/vehicle_type on the caller's own row stay unchanged.
--   (b) A direct UPDATE on public.drivers is denied (no driver UPDATE policy)
--       -> 0 rows affected.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_active  boolean;
  v_vehicle vehicle_type;
BEGIN
  PERFORM public.update_own_driver_contact('079 000 00 00', 'anna+new@example.com',
                                           'Teststrasse', '1', '8600', 'Dübendorf');
  SELECT is_active, vehicle_type INTO v_active, v_vehicle
    FROM public.drivers WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  IF v_active IS DISTINCT FROM true OR v_vehicle IS DISTINCT FROM 'standard' THEN
    RAISE EXCEPTION 'SECURITY FAIL (Fall 3a): whitelisted RPC changed is_active/vehicle_type';
  END IF;
  -- And it DID persist a whitelisted field (sanity check the RPC actually ran).
  IF (SELECT phone FROM public.drivers WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
       IS DISTINCT FROM '079 000 00 00' THEN
    RAISE EXCEPTION 'SECURITY FAIL (Fall 3a): whitelisted RPC did not persist phone';
  END IF;
END $$;

DO $$
DECLARE
  v_rows int;
BEGIN
  UPDATE public.drivers SET is_active = false, vehicle_type = 'wheelchair'
   WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'SECURITY FAIL (Fall 3b): driver directly updated % drivers row(s)', v_rows;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- FALL 4: a driver cannot re-home an availability entry onto a FOREIGN driver.
--   (a) INSERT with driver B's id -> availability_insert_driver WITH CHECK
--       (driver_id = get_user_driver_id()) -> must RAISE.
--   (b) UPDATE an existing row to point at driver B -> no UPDATE policy on
--       driver_availability, so 0 rows change (the re-home never lands).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  BEGIN
    INSERT INTO public.driver_availability (driver_id, day_of_week, start_time, end_time)
    VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'tuesday', '10:00', '12:00');
    RAISE EXCEPTION 'SECURITY FAIL (Fall 4a): driver inserted availability for a foreign driver_id';
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN NULL; -- expected: WITH CHECK blocked it
  END;
END $$;

DO $$
DECLARE
  v_rows int;
BEGIN
  -- Try to re-home driver B's existing availability row onto driver A (or vice
  -- versa) — with no UPDATE policy this affects nothing.
  UPDATE public.driver_availability
     SET driver_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
   WHERE driver_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'SECURITY FAIL (Fall 4b): driver re-homed % availability row(s)', v_rows;
  END IF;
END $$;

-- =============================================================================
-- Back to superuser and roll everything back (idempotent, no residue).
-- =============================================================================
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'M12 SECURITY: all DB assertions passed'; END $$;

ROLLBACK;
