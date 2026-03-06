# Peter's Agent Memory - Dispo Project

## Project Structure
- Next.js 14 App Router project with Supabase
- `src/lib/types/database.ts` - Hand-written DB types (Supabase format with Row/Insert/Update)
- `src/lib/supabase/client.ts` - Browser client (createBrowserClient)
- `src/lib/supabase/server.ts` - Server client (createServerClient with cookies)
- `src/lib/supabase/middleware.ts` - Middleware client
- `src/lib/auth/require-auth.ts` - Auth guard (returns role, userId, driverId)
- `src/lib/rides/status-machine.ts` - Ride status state machine (pure functions)
- `src/lib/rides/constants.ts` - Status labels, colors, FACILITY_TYPE_LABELS
- `src/lib/utils/dates.ts` - Shared date utilities (getToday, addDays, getMondayOf, getSundayOf, formatDateDE, formatDayLabel, formatWeekRange, getWeekDates)
- `src/lib/maps/styles.ts` - Google Maps retro style URL params
- `supabase/migrations/` - SQL migration files
- `docs/adrs/` - Architecture Decision Records (001-012)

## TypeScript Config
- `strict: true`, `noUncheckedIndexedAccess: true`
- Path alias: `@/*` -> `./src/*`
- Target: ES2017

## Database Schema
- 8 tables + patient_impairments: profiles, patients, drivers, destinations, ride_series, rides, driver_availability, communication_log
- Enums: user_role, ride_status, ride_direction, facility_type, vehicle_type, recurrence_type, day_of_week, impairment_type
- NOTE: `destination_type` was replaced by `facility_type` in M6 (ADR-004)
- NOTE: destinations.name was renamed to destinations.display_name in M6
- NOTE: destinations.notes was replaced by destinations.comment in M6
- M4: drivers table extended with street, house_number, postal_code, city, vehicle, driving_license, emergency_contact_name, emergency_contact_phone
- M4: driver_availability removed is_active and updated_at; fixed 2h slot model (08/10/12/14/16)
- M4: DELETE policies added on driver_availability (replace-all strategy)
- 2 helper functions: get_user_role(), get_user_driver_id()
- RLS on ALL tables, DELETE policies on driver_availability only
- All SECURITY DEFINER functions have `SET search_path = public`
- Auth helper functions have REVOKE/GRANT (only `authenticated` role can execute)
- handle_new_user() hardcodes role to 'operator' (SEC-001 fix)

## Security Fixes Applied
- SEC-001: handle_new_user() hardcodes 'operator' role
- SEC-002: search_path + REVOKE/GRANT on helper functions
- SEC-003/005: rides_update_driver has explicit WITH CHECK
- SEC-010: comm_log_insert_auth restricts to ride-authorized users
- SEC-011: rides_select_driver includes `AND is_active = true`

## Auth Pattern
- Use `requireAuth(["admin", "operator"])` from `@/lib/auth/require-auth` in Server Actions
- Returns discriminated union: `{ authorized: true, userId, role, driverId }` or `{ authorized: false, error }`
- Creates its own Supabase client internally -- create separate client for DB ops after auth check

## Conventions
- All code comments in English
- Explanations to user in German
- Supabase client uses `Database` type from `@/lib/types/database`
- Timestamps are `timestamptz` (UTC), displayed as `string` in TS types
- UUID columns typed as `string` in TypeScript
- React 18: `useFormState` from `react-dom` (NOT `useActionState`)
- Next.js 14: params are `Promise<{ id: string }>`, must `await params`
- Empty-to-null: `.transform(v => v === '' ? null : v).nullable().optional()`
- Shared AddressFields component at `src/components/shared/address-fields.tsx`
- PageHeader supports `backHref`/`backLabel` props (renders as link-style back navigation)

## Settings Pages
- Settings navigation: `src/components/settings/settings-nav.tsx` (client, tab-style nav)
- Settings sub-pages: zones, fares, geocoding (all under `/settings/`)
- Each settings page includes `<SettingsNav />` between PageHeader and content
- Nav entry "Einstellungen" points to `/settings/zones` (dashboard-nav.tsx)
- Geocoding retry: `src/actions/geocoding.ts` + `src/components/settings/retry-geocoding-card.tsx`

## Maps / Geocoding
- `src/lib/maps/geocode.ts` - `geocodeAddress()` (pure) + `geocodeAndUpdateRecord()` (fire-and-forget)
- `geocodeAndUpdateRecord` creates its own Supabase client internally
- For batch operations, use `geocodeAddress` directly + manual DB update with shared client

## Ride Series Integration (Phase 5)
- Series toggle in ride form uses hidden field `enable_series` to delegate from `createRide` to internal `createRideWithSeries`
- `createRideWithSeries` is NOT exported (internal helper) -- avoids useFormState action-switching issues in React 18
- Series generation uses `generateDatesForSeries` + `expandDirections` from `@/lib/ride-series/generate`
- Default generation window: 90 days if no end_date specified
- Price calculation only for initial ride (series rides are unplanned, no driver)
- Pattern for conditional form behavior in React 18: hidden input + delegation in server action (NOT dynamic useFormState)

## UI Patterns (M10)

### Card Grid + Detail Sheet Pattern
- Destinations and Patients use responsive card grids instead of tables
- Grid class: `grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3`
- Card click opens Sheet (side="right", 480px) with full details
- Sheet includes: all fields, Google Maps embed, "Bearbeiten" link, DeactivateDialog footer
- Components: `{entity}-card.tsx` (card), `{entity}-detail-sheet.tsx` (sheet)
- Filter/search logic stays in the parent table component (e.g. `destinations-table.tsx`)
- shadcn components used: Sheet, AlertDialog, Separator, Card

### Weekly Calendar Pattern
- /rides and /dispatch default to week view (7-column Mon-Sun grid)
- URL branching: `?date=` → day view, `?week=` → specific week, no param → current week
- Shared `WeekNav` component at `src/components/shared/week-nav.tsx`
- Shared date utilities at `src/lib/utils/dates.ts` (replaces duplicated addDays/formatDateDE)
- Ride pills: status dot + time + patient name, max 8 per day with overflow
- Dispatch pills add: driver assignment status, unassigned count badges

### Dashboard Map
- `src/components/dashboard/dashboard-map.tsx` - Async server component, uses Suspense
- Google Maps Static API (<img> tag, not iframe), retro styling from `@/lib/maps/styles`
- Red H markers = patients with rides today, Blue Z markers = destinations with rides today
- Deduplicates coordinates, returns null if no API key, EmptyState if no geocoded locations

## Mail System (M11)
- `src/lib/mail/utils.ts` - Shared utilities: escapeHtml, formatDate (long German), formatCHF, formatTime
- `src/lib/mail/load-order-sheet-data.ts` - OrderSheetData interface + loader (ride+patient+destination+driver+impairments)
- `src/lib/mail/send-driver-notification.ts` - Uses loadOrderSheetData, resolveDriverEmail helper
- Templates use `RIDE_DIRECTION_LABELS` from `@/lib/rides/constants` (not local copies)
- All user data in templates must be escaped via `escapeHtml()` (XSS protection)
- `formatDate()` in mail/utils.ts uses long format ("Mittwoch, 25. Februar 2026") vs short format in lib/utils/dates.ts
- `loadOrderSheetData()` uses createAdminClient (service role, bypasses RLS)
- Email resolution pattern: drivers.email preferred, fallback to profiles.email
- Order sheet template: `src/lib/mail/templates/order-sheet.ts` - `assembleOrderSheet(data)` composes all sections
- Section renderers in `src/lib/mail/templates/sections/`: header.ts, patient-block.ts, destination-block.ts, driver-block.ts
- Section pattern: each exports a single render function, returns HTML table rows, uses `row()` helper for label-value pairs
- Order ref format: `F-YYMMDD-last4` (e.g. F-260225-a3f1), generated from date + rideId
- `IMPAIRMENT_TYPE_LABELS` added to constants.ts: rollator/wheelchair/stretcher/companion
- Email design: 600px max, table-based layout, inline CSS, system font stack, print-friendly @media

## Important Lessons
- Dashboard page (`src/app/(dashboard)/page.tsx`) also queries destinations -- remember to update when renaming columns
- `src/lib/rides/constants.ts` contains label maps for enums -- must be updated when enum types change
- When renaming DB columns, search entire `src/` for ALL references (queries, types, component props, search filters)
- Linter auto-formats new files -- read-before-write may be needed after initial creation
- When using Supabase `.select()` with joins, the result type may include `null` -- define explicit type aliases and cast when grouping into Maps
- shadcn `add --overwrite` flag can revert custom component styles (e.g. button.tsx) -- always check git diff after install
