# Dispo

Dispatch application for a Swiss medical transport service (*Fahrdienst*). Operators plan and assign patient rides, drivers see their schedule and update ride status in real time.

**UI language:** German throughout.

## Table of Contents

- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Architecture Overview](#architecture-overview)
- [Fahrer-Self-Service](#fahrer-self-service)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Database](#database)
- [Release & Deployment](#release--deployment)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14.2 (App Router) |
| Language | TypeScript 5 (`strict`, `noUncheckedIndexedAccess`) |
| Auth & DB | Supabase (Postgres, Auth with PKCE, RLS) |
| Supabase Client | `@supabase/ssr` 0.8 (cookie-based SSR) |
| UI | Tailwind CSS 3.4, shadcn/ui (Radix primitives) |
| Validation | Zod |
| Hosting | Vercel |

## Prerequisites

- **Node.js** >= 18
- **npm** >= 9
- A **Supabase project** (free tier is sufficient for development)
- **Supabase CLI** (optional, for generating types and running migrations locally)

## Setup

### 1. Clone the repository

```bash
git clone git@github.com:<org>/dispo.git
cd dispo
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example file and fill in your Supabase credentials:

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

| Variable | Description | Where to find |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase Dashboard > Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key | Same page |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-only, **never expose to client**) | Same page |
| `NEXT_PUBLIC_APP_URL` | Application URL (`http://localhost:3000` for dev) | -- |

The `NEXT_PUBLIC_` prefix makes a variable available in browser code. The anon key is safe to expose because RLS is the security boundary. The service role key bypasses RLS and must remain server-only.

### 4. Set up the database

Apply the migration files in order against your Supabase project. You can use the Supabase Dashboard SQL editor or the CLI:

```bash
# Using Supabase CLI (if linked to your project)
supabase db push
```

Or manually apply each file from `supabase/migrations/` in the Supabase SQL editor:

1. `20260218_000001_initial_schema.sql` -- full schema, enums, RLS policies, triggers
2. `20260219_000001_add_email_to_profiles.sql`
3. `20260220_000001_fix_sec006_destinations_deactivated_users.sql`

### 5. Create the first admin user

1. Go to **Supabase Dashboard > Authentication > Users** and create a user with email/password.
2. The `handle_new_user()` trigger will auto-create a profile with role `operator`.
3. Manually update the profile role to `admin` in the SQL editor:

```sql
UPDATE profiles SET role = 'admin' WHERE id = '<user-uuid>';
```

This admin can then create additional users through the application UI.

### 6. Configure Supabase Auth

In **Supabase Dashboard > Authentication > URL Configuration**:

- **Site URL**: `http://localhost:3000` (or your production URL)
- **Redirect URLs**: `http://localhost:3000/auth/callback`

Under **Auth Providers**, ensure **Email** is enabled with "Confirm email" turned off for development (or configure an SMTP provider).

### 7. Start development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You will be redirected to `/login`.

---

## Architecture Overview

### App Router & Server Components

The application uses Next.js 14 App Router with Server Components as the default. Client Components (`'use client'`) are used only where interactivity is required (forms, toast notifications, navigation state).

```
Request -> Middleware (session refresh) -> Server Component (data fetch) -> Render
                                       -> Server Action (mutations)     -> revalidatePath
```

**Middleware** (`src/middleware.ts`) runs on every request to refresh the Supabase session cookie. It redirects unauthenticated users to `/login` and authenticated users away from `/login`.

### Server Actions

All mutations go through Server Actions in `src/actions/`. Each action:

1. Validates input with Zod (schemas in `src/lib/validations/`)
2. Checks authorization (e.g., `requireAdmin()` for user management)
3. Calls Supabase with the server client
4. Returns a discriminated union `ActionResult<T>` (`{ success: true, data }` | `{ success: false, error }`)
5. Calls `revalidatePath()` to refresh cached data

### Row Level Security (RLS)

**Every table** has RLS enabled. There are no `DELETE` policies -- records are soft-deleted via `is_active = false`.

Three roles control access:

| Role | Can do |
|---|---|
| `admin` | Full access to all tables, manage users |
| `operator` | Read/write patients, drivers, destinations, rides, ride series |
| `driver` | Read own assigned rides and related patient data, update ride status |

RLS policies use two `SECURITY DEFINER` helper functions:

- `get_user_role()` -- returns the current user's role from `profiles`
- `get_user_driver_id()` -- returns the `driver_id` linked to the current user

Both functions have `SET search_path = public` and are restricted to the `authenticated` role via `REVOKE/GRANT`.

### Authentication Flow

1. User submits email/password on `/login`
2. Server Action calls `supabase.auth.signInWithPassword()`
3. Supabase returns session tokens, stored as HTTP-only cookies via `@supabase/ssr`
4. PKCE callback route (`/auth/callback`) handles code exchange for OAuth/magic link flows
5. Middleware refreshes session on every request

### Ride Status State Machine

Rides follow a defined lifecycle enforced in application code (`src/lib/rides/status-machine.ts`):

```
unplanned -> planned -> confirmed -> in_progress -> picked_up -> arrived -> completed
                  \-> rejected (-> planned)
          (any non-terminal) -> cancelled
          in_progress -> no_show
```

Terminal statuses: `completed`, `cancelled`, `no_show`.

---

## Fahrer-Self-Service

Milestone **M12** introduces a mobile-first self-service area for drivers (route prefix `/fahrer/*`) plus a staff review queue for absence requests (`/abwesenheiten`). The architectural foundation was laid in [ADR 006](docs/adrs/006-driver-self-service.md); M12 extends it with an invitation flow, driver self-editing of contact data, weekly availability with date exceptions, and an absence workflow.

> The rides list a driver sees for a given day still lives at `/my/rides` (in the `(dashboard)` route group). The new `/fahrer/*` shell is the driver's home, availability, absences and profile.

### Roles and permissions

Three roles exist; a driver's capabilities are intentionally narrow.

| Role | Can do |
|---|---|
| `admin` | Full access to all tables, manage users, **invite drivers** |
| `operator` | Read/write patients, drivers, destinations, rides, ride series; **approve/reject absences** |
| `driver` | See own assigned rides, update own ride status, edit own **contact/address data**, manage own **availability**, request/cancel own **absences** |

A driver **may**:

- edit their own **contact and address** (phone, email, street, house number, postal code, city) via `/fahrer/profil`
- maintain their **availability** (weekly grid + date exceptions) via `/fahrer/verfuegbarkeit`
- **request** and **cancel** their own **absences** via `/fahrer/abwesenheiten`

A driver **may not**:

- **accept or decline rides** — ride acceptance is a separate milestone, not part of M12
- edit their **master data** (first/last name, vehicle, driving licence, emergency contact) — those remain staff-only. The self-service RPC (`update_own_driver_contact`) whitelists exactly six contact/address columns and ignores anything else.

The driver navigation is only a UI filter. The real access boundary is RLS plus `requireAuth(["driver"])` in every server action. A driver who manually opens a staff URL sees an empty list (RLS blocks the `SELECT`).

### Invitation flow

Drivers do not self-register. An **admin** invites a driver from the driver detail sheet (`inviteDriver` in `src/actions/driver-invite.ts`). The flow is deliberately ordered so that an invite link never goes out while the account still has operator privileges:

```
Admin invites driver (email)
  1. createUser(email_confirm: true)   — no mail yet
        └─ handle_new_user() trigger defaults the new profile to role='operator'  [SEC-001]
  2. Correct the profile: UPDATE role='driver', driver_id=<driverId>  (both set together, verified: exactly 1 row)
        └─ on failure → deleteUser() rollback (never leave an orphaned operator account)
  3. resetPasswordForEmail(redirectTo: <APP_URL>/auth/callback?next=/passwort-setzen)
```

The driver receives a set-password mail, lands on `/auth/callback` (PKCE exchange establishes a session), is forwarded to `/passwort-setzen`, chooses a password, and is then routed to their driver home. The same `/passwort-setzen` target is reused by the normal password-reset flow.

**Operational prerequisites** for the invitation flow to work:

| Requirement | Why |
|---|---|
| **Supabase SMTP** configured (Auth > SMTP Settings) | The set-password mail is sent by Supabase Auth. Without a real SMTP provider the invite mail is not delivered (the default sandbox sender is rate-limited and unsuitable for production). |
| **Redirect allowlist** contains `<APP_URL>/auth/callback` (Auth > URL Configuration) | Supabase only redirects to allow-listed URLs; a missing entry breaks the callback and thus the whole invite. |
| `NEXT_PUBLIC_APP_URL` set to the real origin | Used to build the absolute redirect URL. In production the invite is **aborted** if this is unset, to avoid sending unusable `localhost` links. |
| `SUPABASE_SERVICE_ROLE_KEY` (server-only) | `createUser`, the role correction and the rollback all run through the admin client, which bypasses RLS. |

Invitation state is derived on demand (`getDriverInviteStatus`), not stored in a column: `none` (no linked profile), `invited` (linked account that never signed in), `active` (has signed in at least once).

### Availability and the precedence rule

Driver availability lives in the `driver_availability` table and mixes two kinds of entries:

- **Weekly grid** — recurring fixed **2-hour slots**, Monday–Friday (`day_of_week` set, `specific_date` NULL).
- **Date exception** — availability for one concrete calendar date (`specific_date` set, `day_of_week` NULL).

`resolveAvailability(date, entries)` in `src/lib/availability/resolve.ts` is the **single source of truth** for the question *"which time windows is this driver available on date X?"* — the same function backs both the driver's own editor and the dispatch side. Its precedence rule:

> **A date exception fully overrides the weekly grid for that date.** If a date has *any* date-specific entry, the weekly grid is ignored for that day. Otherwise the weekly grid for that weekday applies.

An "empty exception" (a date entry with no time window) is an explicit *"not available that day"* marker: it triggers the override but contributes no window, so the resolved result is empty. (The current fixed-slot UI always stores a time with a slot, so it cannot persist an empty exception itself; the resolver still supports it so dispatch and tests can express "unavailable that day" cleanly.) Resolved windows are always normalized: sorted, zero-length dropped, and touching/overlapping windows merged into contiguous ranges.

The module is intentionally free of DB/React/Next dependencies so it can be unit-tested in isolation.

### Absences and the status state machine

Drivers request time off (`vacation` / `sick` / `training` / `other`); staff decide. The lifecycle is modelled in `src/lib/absences/status-machine.ts`:

```
requested ──▶ approved   (staff only, via decide_absence RPC)
          ├─▶ rejected   (staff only, via decide_absence RPC)
          └─▶ cancelled  (driver, via cancel_own_absence RPC)
approved  ──▶ cancelled  (staff / dispatch)
rejected  ── (terminal)
cancelled ── (terminal)
```

Key rules — the DB (RLS + RPCs) is always the enforcing authority; the status machine only shapes what the UI renders:

- **Staff decide** requested → approved | rejected via the `decide_absence` RPC (stamps `decided_by = auth.uid()` server-side). The server action additionally checks `canTransition` before calling the RPC (defence in depth).
- **A driver may cancel only while `requested`.** Once staff have `approved` an absence, the driver can no longer withdraw it themselves — cancellation is then a dispatch decision. This is enforced in the UI via `canDriverCancel()` (returns true only for `requested`). The `cancel_own_absence` RPC is a little more permissive at the DB layer (it also allows cancelling an `approved` row, e.g. when staff revoke), but the driver UI narrows this to `requested`.
- **Overlap protection is a database constraint**, not application logic: `driver_absences_no_overlap`, a GiST exclusion constraint, rejects a new `requested`/`approved` period that overlaps an existing active one for the same driver. Only `requested` and `approved` rows participate — a `cancelled` or `rejected` period never blocks a fresh request for the same dates. The server action translates the raw SQLSTATE (`23P01`) into a friendly German message.
- **No hard deletes.** Cancellation is a soft status change; there is no `DELETE` policy on `driver_absences`.

The self-service write paths that a driver cannot perform via direct table access are provided as narrow `SECURITY DEFINER` RPCs (`request_absence`, `cancel_own_absence`, `update_own_driver_contact`), each deriving the driver identity from the session via `get_user_driver_id()` — never from a client argument.

### Driver routes

| Route | Purpose | Guard |
|---|---|---|
| `/fahrer` | Driver home: greeting, next rides, open absences, quick tiles | `requireAuth(["driver"])` |
| `/fahrer/verfuegbarkeit` | Weekly availability grid + date exceptions | `requireAuth(["driver"])` |
| `/fahrer/abwesenheiten` | Request absences, cancel own `requested` requests, see history | `requireAuth(["driver"])` |
| `/fahrer/profil` | Edit own contact/address data | `requireAuth(["driver"])` |
| `/my/rides` | Own assigned rides for a day (status updates) | `requireAuth(["driver"])` |
| `/abwesenheiten` | Staff queue: approve/reject absence requests | `requireAuth(["admin","operator"])` |

### In-app help

The help system (Epic #83) has two entry points backed by the same article set:

- **`/help`** — public, unauthenticated help home (public-only articles).
- **`/hilfe`** — authenticated, **role-aware** help hub inside the dashboard: greets the user by name and shows articles matching their role (public content plus role-specific content).

Point drivers at **`/hilfe`** for step-by-step, role-appropriate guidance.

---

## Project Structure

```
src/
  app/
    (auth)/login/          # Login page (public)
    (dashboard)/           # Protected layout with nav + logout
      page.tsx             # Dashboard home
      patients/            # CRUD: list, new, [id]/edit
      drivers/             # CRUD: list, new, [id]/edit
      destinations/        # CRUD: list, new, [id]/edit
      rides/               # CRUD: list, new, [id]/edit
      users/               # CRUD: list, new, [id]/edit (admin-only)
    auth/callback/         # PKCE code exchange route handler
    layout.tsx             # Root layout (Inter font, Toaster)
    globals.css            # Tailwind base + CSS variables
  actions/
    auth.ts                # login, logout
    patients.ts            # createPatient, updatePatient, togglePatientActive
    drivers.ts             # createDriver, updateDriver, toggleDriverActive
    destinations.ts        # createDestination, updateDestination, ...
    rides.ts               # createRide, updateRide, ...
    users.ts               # createUser, updateUser, toggleUserActive
    shared.ts              # ActionResult type
  components/
    ui/                    # shadcn/ui primitives (Button, Input, Select, ...)
    shared/                # Reusable: SubmitButton, ActiveBadge, AddressFields, EmptyState
    dashboard/             # DashboardNav, PageHeader
    {entity}/              # Entity-specific form and table components
  lib/
    supabase/
      client.ts            # Browser client (createBrowserClient)
      server.ts            # Server client (createServerClient + cookies)
      middleware.ts         # Middleware session refresh
    auth/
      require-admin.ts     # Admin authorization guard
    rides/
      status-machine.ts    # Ride status transitions (pure functions)
    types/
      database.ts          # Supabase Database types (generated)
    validations/
      patients.ts          # Zod schemas per entity
      drivers.ts
      destinations.ts
      rides.ts
      users.ts
    utils.ts               # cn() utility (clsx + tailwind-merge)
supabase/
  migrations/              # SQL migration files (YYYYMMDD_HHMMSS_description.sql)
```

### CRUD Pattern

Each entity (patients, drivers, destinations, rides, users) follows the same pattern:

| Concern | File | Type |
|---|---|---|
| Validation | `src/lib/validations/{entity}.ts` | Zod schema |
| Mutations | `src/actions/{entity}.ts` | Server Actions |
| Form | `src/components/{entity}/{entity}-form.tsx` | Client Component |
| Table | `src/components/{entity}/{entity}-table.tsx` | Client Component |
| List page | `src/app/(dashboard)/{entity}/page.tsx` | Server Component |
| Create page | `src/app/(dashboard)/{entity}/new/page.tsx` | Server Component |
| Edit page | `src/app/(dashboard)/{entity}/[id]/page.tsx` | Server Component |
| Loading | `src/app/(dashboard)/{entity}/loading.tsx` | Skeleton UI |

---

## Development Workflow

### Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run all tests once (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run db:types` | Regenerate Supabase TypeScript types |
| `npm run db:types:check` | Verify types are in sync (CI use) |

### Branching & Commits

- Work on **feature branches** off `main`
- Use descriptive branch names: `feat/ride-calendar`, `fix/rls-driver-policy`
- Write atomic commits with clear messages
- Open a Pull Request for review before merging to `main`

### Adding a New Entity

1. Write the SQL migration in `supabase/migrations/` (include RLS policies)
2. Apply the migration and regenerate types: `npm run db:types`
3. Create the Zod schema in `src/lib/validations/`
4. Create Server Actions in `src/actions/`
5. Create form and table components in `src/components/{entity}/`
6. Create pages in `src/app/(dashboard)/{entity}/`
7. Add navigation link in `src/components/dashboard/dashboard-nav.tsx`

### Database Migrations

Migration files live in `supabase/migrations/` with the naming convention:

```
YYYYMMDD_HHMMSS_description.sql
```

Rules:
- Migrations must be **idempotent** where possible (use `CREATE OR REPLACE`, `IF NOT EXISTS`)
- Always include RLS policies for new tables
- Never add `DELETE` policies -- use soft delete (`is_active = false`)
- `SECURITY DEFINER` functions must include `SET search_path = public`
- Auth helper functions need `REVOKE ALL FROM PUBLIC` + `GRANT EXECUTE TO authenticated`

---

## Testing

The project uses [Vitest](https://vitest.dev/) for unit and integration tests. The `@/` path alias is configured in `vitest.config.ts`.

### Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch
```

### Test File Conventions

- Test files use the `*.test.ts` suffix
- Tests live in `__tests__/` directories next to the source they cover
- Example structure:

```
src/lib/validations/
  patients.ts
  __tests__/
    patients.test.ts
src/lib/rides/
  status-machine.ts
  __tests__/
    status-machine.test.ts
src/actions/
  rides.ts
  __tests__/
    rides.test.ts          # integration smoke tests with mocked Supabase
```

### What's Tested

| Area | Coverage |
|---|---|
| Ride status machine | State transitions, role-based permissions, terminal statuses |
| Zod validation schemas | Required fields, empty-to-null transforms, enum values, max length, cross-field refinements |
| Server Actions (smoke) | `updateRideStatus` with mocked Supabase — invalid transitions, unauthorized roles, happy path |

---

## Release & Deployment

### Vercel Deployment

The application is deployed to **Vercel**. Every push to `main` triggers a production deployment. Pull requests get preview deployments automatically.

#### Environment Variables on Vercel

Set the same variables from `.env.local` in **Vercel > Project Settings > Environment Variables**:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL` (set to your production domain)

Make sure `SUPABASE_SERVICE_ROLE_KEY` is only available in the **Production** and **Preview** environments (server-side only).

#### Production Checklist

- [ ] All migrations applied to the production Supabase project
- [ ] Environment variables set in Vercel
- [ ] Supabase Auth **Site URL** and **Redirect URLs** updated to production domain
- [ ] At least one admin user exists in the production database
- [ ] `npm run build` passes without errors
- [ ] `npm run db:types:check` passes (types in sync)

### Database Changes in Production

1. Write the migration SQL file
2. Test against a staging/development Supabase project first
3. Apply to production via Supabase Dashboard SQL editor or CLI
4. Regenerate and commit updated types: `npm run db:types`

---

## Troubleshooting

### Authentication Issues

**"Nicht authentifiziert" error after login**

- Check that `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are correct in `.env.local`
- Verify the Supabase project is running and accessible
- Check browser DevTools > Application > Cookies for `sb-*` cookies. If missing, the session was not established.

**Login succeeds but immediately redirects back to `/login`**

- The middleware refreshes the session on every request. If the session cookie is not being set, check that the `@supabase/ssr` cookie handler is working.
- In development, make sure you are accessing `http://localhost:3000` (not `127.0.0.1` or a different port).
- Check that **Site URL** in Supabase Auth settings matches your actual URL.

**PKCE callback fails (`/auth/callback` returns error)**

- Verify that `http://localhost:3000/auth/callback` is listed in Supabase Auth **Redirect URLs**.
- The callback exchanges an auth code for a session. If the code is expired or already used, it will fail. Try logging in again.

### Database & RLS Issues

**"permission denied for table" or empty query results**

- RLS is enabled on all tables. If you get empty results, the current user's role likely does not have a matching policy.
- Check the user's role: `SELECT role, is_active FROM profiles WHERE id = '<user-uuid>';`
- An inactive profile (`is_active = false`) will return `NULL` from `get_user_role()`, causing all policies to deny access.

**New user has no profile / "Profil nicht gefunden"**

- The `handle_new_user()` trigger should auto-create a profile when a user is created via Supabase Auth.
- If the trigger is missing, apply the initial migration or manually create the profile:

```sql
INSERT INTO profiles (id, display_name, role)
VALUES ('<auth-user-uuid>', 'Name', 'operator');
```

**Cannot create users through the app**

- User creation requires the `SUPABASE_SERVICE_ROLE_KEY` environment variable (server-side only).
- Only users with role `admin` can access the user management UI. Check the profile role.
- The service role key bypasses RLS -- if it is missing or wrong, user creation via `supabase.auth.admin.createUser()` will fail.

**Invited driver has operator permissions (sees the staff dashboard, not `/fahrer`)**

- Root cause: the `handle_new_user()` trigger hardcodes every new profile to role `operator` (SEC-001). The invitation flow (`inviteDriver`) is responsible for **explicitly correcting** the freshly created profile to role `driver` and linking its `driver_id`. If that correction did not take effect, the account is stuck as an operator.
- The invite flow is designed to roll back (delete the auth user) if the correction fails, so a leftover operator account should not normally exist. If you see one, the rollback itself failed — check the server logs for a `CRITICAL: rollback deleteUser failed` message; the account needs manual cleanup.
- Verify the profile state:

```sql
SELECT id, role, driver_id FROM public.profiles WHERE email = '<fahrer-email>';
```

Expected: `role = 'driver'` **and** a non-NULL `driver_id`. If you see `role = 'operator'`, the invitation correction did not complete. Delete the account (Supabase Dashboard > Authentication > Users) and invite the driver again.

- Note: `role` and `driver_id` must always be set **together** (enforced by the `profile_driver_link_check` constraint). A profile with `role = 'driver'` but a NULL `driver_id` (or vice versa) indicates a broken invite.

### Session Issues

**User gets randomly logged out**

- The middleware must call `supabase.auth.getUser()` immediately after creating the server client. Any logic between client creation and `getUser()` can cause session refresh issues.
- Do not create a new `NextResponse` after the middleware Supabase client has set cookies. Always return the `supabaseResponse` object.

**Session not persisting across page navigations**

- Verify that the middleware matcher is not too restrictive. The current matcher excludes static files and images but runs on all other routes.
- Check that cookies are not being blocked by browser settings or extensions.

### Build & Type Issues

**TypeScript errors after database schema changes**

- Regenerate types: `npm run db:types`
- If using the Supabase CLI, make sure it is linked to the correct project.

**`npm run build` fails with type errors**

- Run `npm run lint` first to check for ESLint issues.
- Check that all imports use the `@/*` path alias (mapped to `./src/*`).
- Verify that no `any` types have been introduced -- the project uses `strict: true`.

**`db:types:check` fails in CI**

- Someone changed the database schema but did not regenerate and commit the types file.
- Run `npm run db:types` locally, verify the diff, and commit the updated `src/lib/types/database.ts`.

## Fahrt erfassen (One-Page-Dispo)

Milestone **M13** adds a dedicated ride-capture page at `/rides/erfassen` — a two-column "One-Page-Dispo" screen for dispatchers. The left column captures **who → where → when**; the right column shows the map, the back-calculated pickup time(s) and the price **live**, without saving.

Key ideas:

- **Time model** (`src/lib/rides/time-calc.ts`): outbound pickup = appointment start − drive time − pickup buffer − boarding; return pickup = appointment end + return buffer; appointment end = appointment start + duration. The three buffers are org-wide defaults (`organization_settings`, loaded via `loadRideTimeBuffers`) and overridable per ride.
- **Round trip = two linked rides**: the return leg is a separate `rides` row with `direction=return` and `parent_ride_id` pointing at the outbound (ADR-008).
- **Cost bearer** lives on the patient (`cost_bearer`), never on the ride. **Requirements** (`ride_requirement[]`) live on the ride; only `wheelchair` influences the vehicle type (`requirementsToVehicleType`).
- **Never block**: missing geocoding, price or appointment time produce non-blocking `warnings` (`collectRideWarnings`) instead of hard errors — `createRide` saves and returns `success: true` with warnings instead of redirecting. `save_intent=order_sheet` suppresses the redirect so the M11 order sheet can open.
- **Driver assignment is out of scope** here — captured rides start `unplanned` and are assigned later in the dispatch board.

The existing `ride-form.tsx` (editing) is unchanged. Design rationale: [ADR-014](docs/adrs/014-fahrt-erfassung.md). Dispatcher walkthrough: [docs/guides/fahrt-erfassen.md](docs/guides/fahrt-erfassen.md).

---

