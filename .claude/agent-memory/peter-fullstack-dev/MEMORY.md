# Peter's Agent Memory - Dispo Project

## Project Structure
- Next.js 14 App Router project with Supabase
- `src/lib/types/database.ts` - Hand-written DB types (Supabase format with Row/Insert/Update)
- `src/lib/supabase/client.ts` - Browser client (createBrowserClient)
- `src/lib/supabase/server.ts` - Server client (createServerClient with cookies)
- `src/lib/supabase/middleware.ts` - Middleware client
- `src/lib/rides/status-machine.ts` - Ride status state machine (pure functions)
- `supabase/migrations/` - SQL migration files

## TypeScript Config
- `strict: true`, `noUncheckedIndexedAccess: true`
- Path alias: `@/*` -> `./src/*`
- Target: ES2017

## Database Schema (ADR-002)
- 8 tables: profiles, patients, drivers, destinations, ride_series, rides, driver_availability, communication_log
- 7 enums: user_role, ride_status, ride_direction, destination_type, vehicle_type, recurrence_type, day_of_week
- 2 helper functions: get_user_role(), get_user_driver_id()
- RLS on ALL tables, no DELETE policies (soft delete via is_active)
- All SECURITY DEFINER functions have `SET search_path = public`
- Auth helper functions have REVOKE/GRANT (only `authenticated` role can execute)
- handle_new_user() hardcodes role to 'operator' (SEC-001 fix)

## Security Fixes Applied
- SEC-001: handle_new_user() hardcodes 'operator' role
- SEC-002: search_path + REVOKE/GRANT on helper functions
- SEC-003/005: rides_update_driver has explicit WITH CHECK
- SEC-010: comm_log_insert_auth restricts to ride-authorized users
- SEC-011: rides_select_driver includes `AND is_active = true`

## Conventions
- All code comments in English
- Explanations to user in German
- Supabase client uses `Database` type from `@/lib/types/database`
- Timestamps are `timestamptz` (UTC), displayed as `string` in TS types
- UUID columns typed as `string` in TypeScript
