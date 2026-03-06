# Martin - Architect Memory

## Project: Dispo (Fahrdienst Dispatch)

### Stack Decisions (ADR-001)
- Next.js 14.2.x (not 15) -- stability, React 18 peer dep
- Tailwind CSS 3.4.x (not v4) -- ecosystem maturity, shadcn/ui compat
- @supabase/ssr 0.8.x (not deprecated auth-helpers)
- ESLint 8 (not 9) -- Next.js 14 compat with eslint-config-next
- TypeScript strict + noUncheckedIndexedAccess
- Zod for runtime validation at all boundaries

### Project Structure
- `src/` directory with `@/` path alias
- `src/app/(auth)/` and `src/app/(dashboard)/` route groups
- `src/lib/supabase/` -- three-client pattern (client.ts, server.ts, middleware.ts)
- `src/actions/` -- Server Actions (not co-located with pages)
- `src/components/ui/` -- prepared for shadcn/ui adoption later
- `supabase/migrations/` -- SQL migrations
- `docs/adrs/` -- Architecture Decision Records

### Supabase Auth Pattern
- Browser: createBrowserClient from @supabase/ssr
- Server Components/Actions: createServerClient with cookies()
- Middleware: custom client for session refresh + route protection
- Service role key: server-only, no NEXT_PUBLIC_ prefix

### Database Schema (ADR-002, extended by ADR-003/004/005)
- 9 tables: profiles, patients, patient_impairments, drivers, destinations, ride_series, rides, driver_availability, communication_log
- Enums: user_role, ride_status, ride_direction, facility_type (replaced destination_type), vehicle_type, recurrence_type, day_of_week, impairment_type
- RLS on all tables; helper functions: get_user_role(), get_user_driver_id() (SECURITY DEFINER, STABLE)
- Ride status state machine enforced at application layer (src/lib/rides/status-machine.ts)
- Soft deletes (is_active) on most tables; exceptions: patient_impairments (hard delete, replace-all), driver_availability (hard delete after M4), communication_log (append-only)
- DELETE RLS policies on: patient_impairments (staff), driver_availability (staff + driver own)
- Profile auto-creation trigger on auth.users INSERT
- updated_at trigger on all tables with that column
- Conscious simplifications: no vehicles table (1 driver = 1 vehicle_type), no ride_legs split, no full audit log
- Migration file: supabase/migrations/20260218_000001_initial_schema.sql
- See detailed schema: [database-schema.md](./database-schema.md)

### ADR-005: Driver Profile & Availability (M4)
- drivers extended: street, house_number, postal_code (CH 4-digit), city, vehicle, driving_license, emergency_contact_name/phone
- vehicle_type enum preserved (used in ride assignment logic), vehicle is freetext description
- driver_availability: fixed 2h slots (08/10/12/14/16), weekdays only (Mo-Fr), no is_active/updated_at
- Replace-all strategy for availability (DELETE + INSERT, no UPDATE needed)
- Fahrer can INSERT/DELETE own availability (RLS); staff can manage all
- Fahrer self-service for profile editing deferred (only availability in M4)
- UI: /drivers/[id]/availability route with 5x5 grid
- Plan file: docs/adrs/005-driver-profile-availability.md

### ADR-012: Driver Acceptance Flow (Issues #40-#49)
- Separate `acceptance_tracking` table (not new ride_status values) -- orthogonal lifecycle
- 3 new enums: acceptance_stage, rejection_reason, resolution_method
- Token hashing: SHA-256, column renamed token -> token_hash
- Vercel Cron (1x/min) for reminder engine, supplemented by dispatch page-load check
- SLA windows: T+10m reminder1, T+25m reminder2, T+40m timeout (shortened for <60m rides)
- Driver UI: `/my/rides` enhanced with "Neue Zuweisungen" section
- Dispo Queue: New section on `/dispatch` page (not separate route)
- Feature flag: `ACCEPTANCE_FLOW_ENABLED` env var
- Rejection reasons: Enum + optional free text on acceptance_tracking
- Partial unique index ensures max 1 active tracking per ride
- Plan file: docs/adrs/012-driver-acceptance-flow.md

### UI Architecture Decisions (M10)
- **Card Grid + Sheet** replaces Table for entity list views (destinations, patients)
  - Responsive grid (1/2/3 cols), Sheet (480px right) for detail view
  - Edit navigates to existing /[id]/edit route (not embedded in Sheet)
  - DeactivateDialog: shared AlertDialog wrapper for toggle-active confirmations
- **Weekly Calendar** as default view for /rides and /dispatch
  - URL param branching: `?date=` → day, `?week=` → week, no param → current week (Monday start)
  - Shared WeekNav component, shared date utilities in `src/lib/utils/dates.ts`
  - No additional DB tables — fetches rides for date range and groups client-side
- **Dashboard Map**: Google Maps Static API (<img>), async server component with Suspense
  - No JS API needed — static markers suffice for overview (<50 points in Swiss canton)
  - Retro map styling via `src/lib/maps/styles.ts`
- **shadcn/ui**: Fully adopted — Sheet, AlertDialog, Separator, Card, Badge, etc.

### ADR-013: Order Sheet Email (M11, Proposed)
- Template: HTML-String with modular section functions (not React Email)
- Data loading: dedicated `loadOrderSheetData()` function, reused by mail + preview
- Preview: `GET /api/mail/preview?ride_id=<uuid>` (auth required, text/html response)
- PDF: deferred to M12, HTML template print-optimized instead
- Missing DB fields (vs Access template): salutation, phone_mobile, assigned_by, order_number, surcharge
- Decision: pragmatic -- only show existing fields, no schema change for M11
- Code duplication found: formatDate() 4x, DIRECTION_LABELS 3x (inconsistent with RIDE_DIRECTION_LABELS)
- patients.comment = public (show to driver), patients.notes = internal (do not show)
- Plan file: docs/adrs/013-order-sheet-email.md

### Mail System Architecture
- 3 templates: driver-assignment, driver-reminder, dispatcher-escalation
- All use inline-CSS HTML strings (no React Email)
- Nodemailer + Gmail SMTP (App Password)
- Token: SHA-256, 48h expiry, single-use, action-idempotent
- Admin client used for all mail operations (bypasses RLS)
- Tables: assignment_tokens (token_hash), mail_log (audit), acceptance_tracking (SLA)
- Respond flow: GET -> confirm page, POST -> consume token + mutate ride status

### Open Decisions
- Multi-tenancy pattern: not yet designed
- Security headers: Ioannis to define
- Full audit log: deferred post-MVP
- Database view for driver patient data minimization: deferred post-MVP

### Key Files (relative to repo root)
- See detailed setup: [project-bootstrap.md](./project-bootstrap.md)
