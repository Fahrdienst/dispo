# ADR 002: Database Schema Design

## Status

Proposed

## Date

2026-02-18

## Context

The Dispo application needs a relational database schema to support its core domain: dispatching patient transport rides. The schema must handle patients, drivers, destinations, ride scheduling (including recurring rides), driver availability, and role-based access control. All data lives in Supabase (PostgreSQL, EU Frankfurt).

Key constraints from the project spec:
- No hard deletes (soft delete via `is_active` flag)
- Audit fields (`created_at`, `updated_at`) on every table
- Patient data must be minimized in driver views (HIPAA-adjacent concern)
- Recurring rides need a series concept
- Driver availability is time-block based
- Roles: admin, operator, driver
- RLS on every table, no exceptions

## Decision

### Overview

The schema consists of 7 domain tables, 1 auth-linked profile table, and 7 custom enum types. The design follows these principles:

1. **Flat over nested** -- no JSONB bags for structured data; use proper columns and relations
2. **Enums for closed sets** -- PostgreSQL enums for values that change only via migrations
3. **Explicit state machine** -- ride status transitions enforced at the application layer, documented here as the contract
4. **Soft delete everywhere** -- `is_active` boolean, never `DELETE`
5. **UTC timestamps** -- all `timestamptz`, application layer handles timezone display

---

## 1. Enum Types

```sql
-- User roles in the system
CREATE TYPE public.user_role AS ENUM ('admin', 'operator', 'driver');

-- Ride lifecycle status (see state machine in section 5)
CREATE TYPE public.ride_status AS ENUM (
  'unplanned',    -- ride exists but no driver assigned
  'planned',      -- driver assigned, not yet confirmed
  'confirmed',    -- driver has confirmed the ride
  'in_progress',  -- driver is en route to pickup
  'picked_up',    -- patient is in the vehicle
  'arrived',      -- arrived at destination
  'completed',    -- ride fully done
  'cancelled',    -- cancelled before execution
  'no_show',      -- patient was not present at pickup
  'rejected'      -- driver rejected the assignment
);

-- Direction of a ride leg
CREATE TYPE public.ride_direction AS ENUM ('outbound', 'return', 'both');

-- Destination categories
CREATE TYPE public.destination_type AS ENUM ('hospital', 'doctor', 'therapy', 'other');

-- Vehicle capability classification
CREATE TYPE public.vehicle_type AS ENUM ('standard', 'wheelchair', 'stretcher');

-- Recurrence patterns for ride series
CREATE TYPE public.recurrence_type AS ENUM ('daily', 'weekly', 'biweekly', 'monthly');

-- Days of the week for availability scheduling
CREATE TYPE public.day_of_week AS ENUM (
  'monday', 'tuesday', 'wednesday', 'thursday',
  'friday', 'saturday', 'sunday'
);
```

**Design note:** We use PostgreSQL enums rather than lookup tables because these are closed, small sets that change only through schema migrations. This gives us type safety at the database level. If a set needs to become user-configurable later, we migrate to a lookup table at that point -- not preemptively.

---

## 2. Table Definitions

### 2.1 `profiles`

Links Supabase `auth.users` to application-level identity and role.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | -- | PK, FK -> `auth.users(id)` ON DELETE CASCADE |
| `role` | `user_role` | NO | `'operator'` | -- |
| `display_name` | `text` | NO | -- | CHECK `length(display_name) > 0` |
| `driver_id` | `uuid` | YES | `NULL` | FK -> `drivers(id)`, unique when not null |
| `is_active` | `boolean` | NO | `true` | -- |
| `created_at` | `timestamptz` | NO | `now()` | -- |
| `updated_at` | `timestamptz` | NO | `now()` | -- |

**Notes:**
- `id` is the same UUID as `auth.users.id` -- no separate surrogate key.
- `driver_id` is nullable: only populated when `role = 'driver'`. A CHECK constraint enforces this: `(role = 'driver' AND driver_id IS NOT NULL) OR (role != 'driver' AND driver_id IS NULL)`.
- `display_name` is denormalized from the user's name for quick display without joins.
- The `ON DELETE CASCADE` from `auth.users` is acceptable because Supabase Auth manages user lifecycle. When an auth user is deleted, the profile goes with it.

```sql
CREATE TABLE public.profiles (
  id            uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role          user_role   NOT NULL DEFAULT 'operator',
  display_name  text        NOT NULL CHECK (length(display_name) > 0),
  driver_id     uuid        UNIQUE REFERENCES public.drivers(id),
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT profile_driver_link_check CHECK (
    (role = 'driver' AND driver_id IS NOT NULL)
    OR (role != 'driver' AND driver_id IS NULL)
  )
);
```

---

### 2.2 `patients`

Core entity: the person being transported.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `first_name` | `text` | NO | -- | CHECK `length(first_name) > 0` |
| `last_name` | `text` | NO | -- | CHECK `length(last_name) > 0` |
| `phone` | `text` | YES | `NULL` | -- |
| `street` | `text` | YES | `NULL` | -- |
| `house_number` | `text` | YES | `NULL` | -- |
| `postal_code` | `text` | YES | `NULL` | -- |
| `city` | `text` | YES | `NULL` | -- |
| `needs_wheelchair` | `boolean` | NO | `false` | -- |
| `needs_stretcher` | `boolean` | NO | `false` | -- |
| `needs_companion` | `boolean` | NO | `false` | -- |
| `notes` | `text` | YES | `NULL` | -- |
| `is_active` | `boolean` | NO | `true` | -- |
| `created_at` | `timestamptz` | NO | `now()` | -- |
| `updated_at` | `timestamptz` | NO | `now()` | -- |

```sql
CREATE TABLE public.patients (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name       text        NOT NULL CHECK (length(first_name) > 0),
  last_name        text        NOT NULL CHECK (length(last_name) > 0),
  phone            text,
  street           text,
  house_number     text,
  postal_code      text,
  city             text,
  needs_wheelchair boolean     NOT NULL DEFAULT false,
  needs_stretcher  boolean     NOT NULL DEFAULT false,
  needs_companion  boolean     NOT NULL DEFAULT false,
  notes            text,
  is_active        boolean     NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
```

**Design notes:**
- Address is split into components (not a single text field) for structured display and future geocoding.
- Mobility flags are individual booleans rather than an array/set because they are a closed, small set and need to be queryable for vehicle matching.
- `phone` is nullable because some patients may not have a reachable number (institutional patients, etc.).

---

### 2.3 `drivers`

The transport driver and their vehicle classification.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `first_name` | `text` | NO | -- | CHECK `length(first_name) > 0` |
| `last_name` | `text` | NO | -- | CHECK `length(last_name) > 0` |
| `phone` | `text` | YES | `NULL` | -- |
| `vehicle_type` | `vehicle_type` | NO | `'standard'` | -- |
| `notes` | `text` | YES | `NULL` | -- |
| `is_active` | `boolean` | NO | `true` | -- |
| `created_at` | `timestamptz` | NO | `now()` | -- |
| `updated_at` | `timestamptz` | NO | `now()` | -- |

```sql
CREATE TABLE public.drivers (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name    text          NOT NULL CHECK (length(first_name) > 0),
  last_name     text          NOT NULL CHECK (length(last_name) > 0),
  phone         text,
  vehicle_type  vehicle_type  NOT NULL DEFAULT 'standard',
  notes         text,
  is_active     boolean       NOT NULL DEFAULT true,
  created_at    timestamptz   NOT NULL DEFAULT now(),
  updated_at    timestamptz   NOT NULL DEFAULT now()
);
```

**Design notes:**
- `vehicle_type` lives on the driver, not on a separate `vehicles` table. For MVP, one driver = one vehicle type. If multi-vehicle support is needed later, we extract a `vehicles` table and add a FK. This is a conscious simplification.
- Driver availability is a separate table (2.7) because it is multi-row per driver.

---

### 2.4 `destinations`

Places patients are transported to.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `name` | `text` | NO | -- | CHECK `length(name) > 0` |
| `type` | `destination_type` | NO | `'other'` | -- |
| `street` | `text` | YES | `NULL` | -- |
| `house_number` | `text` | YES | `NULL` | -- |
| `postal_code` | `text` | YES | `NULL` | -- |
| `city` | `text` | YES | `NULL` | -- |
| `department` | `text` | YES | `NULL` | -- |
| `notes` | `text` | YES | `NULL` | -- |
| `is_active` | `boolean` | NO | `true` | -- |
| `created_at` | `timestamptz` | NO | `now()` | -- |
| `updated_at` | `timestamptz` | NO | `now()` | -- |

```sql
CREATE TABLE public.destinations (
  id            uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text              NOT NULL CHECK (length(name) > 0),
  type          destination_type  NOT NULL DEFAULT 'other',
  street        text,
  house_number  text,
  postal_code   text,
  city          text,
  department    text,
  notes         text,
  is_active     boolean           NOT NULL DEFAULT true,
  created_at    timestamptz       NOT NULL DEFAULT now(),
  updated_at    timestamptz       NOT NULL DEFAULT now()
);
```

**Design note:** `department` is a free-text field (e.g., "Radiologie", "Station 3B"). Not worth a lookup table for MVP.

---

### 2.5 `ride_series`

Defines a recurring pattern for ride generation.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `patient_id` | `uuid` | NO | -- | FK -> `patients(id)` |
| `destination_id` | `uuid` | NO | -- | FK -> `destinations(id)` |
| `recurrence_type` | `recurrence_type` | NO | -- | -- |
| `days_of_week` | `day_of_week[]` | YES | `NULL` | Required when recurrence_type is weekly/biweekly |
| `pickup_time` | `time` | NO | -- | -- |
| `direction` | `ride_direction` | NO | `'both'` | -- |
| `start_date` | `date` | NO | -- | -- |
| `end_date` | `date` | YES | `NULL` | -- |
| `notes` | `text` | YES | `NULL` | -- |
| `is_active` | `boolean` | NO | `true` | -- |
| `created_at` | `timestamptz` | NO | `now()` | -- |
| `updated_at` | `timestamptz` | NO | `now()` | -- |

```sql
CREATE TABLE public.ride_series (
  id              uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      uuid              NOT NULL REFERENCES public.patients(id),
  destination_id  uuid              NOT NULL REFERENCES public.destinations(id),
  recurrence_type recurrence_type   NOT NULL,
  days_of_week    day_of_week[],
  pickup_time     time              NOT NULL,
  direction       ride_direction    NOT NULL DEFAULT 'both',
  start_date      date              NOT NULL,
  end_date        date,
  notes           text,
  is_active       boolean           NOT NULL DEFAULT true,
  created_at      timestamptz       NOT NULL DEFAULT now(),
  updated_at      timestamptz       NOT NULL DEFAULT now(),

  CONSTRAINT valid_date_range CHECK (end_date IS NULL OR end_date >= start_date),
  CONSTRAINT weekly_requires_days CHECK (
    (recurrence_type IN ('weekly', 'biweekly') AND days_of_week IS NOT NULL AND array_length(days_of_week, 1) > 0)
    OR (recurrence_type NOT IN ('weekly', 'biweekly'))
  )
);
```

**Design notes:**
- `days_of_week` uses a PostgreSQL array of the `day_of_week` enum. This avoids a join table for a simple multi-select. Arrays of enums are well-supported in PostgreSQL and queryable with `@>` (contains) operator.
- `end_date` is nullable for "indefinite" series. The ride generation job will need a lookahead window (e.g., generate rides 4 weeks ahead).
- Individual rides generated from a series are fully independent rows in `rides` -- the series is the template, not a live link. Cancelling one ride in a series does not affect others.
- The series stores a default `pickup_time` and `direction` but individual rides can override these.

---

### 2.6 `rides`

The central table. One row per individual ride (a single trip on a single day).

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `patient_id` | `uuid` | NO | -- | FK -> `patients(id)` |
| `destination_id` | `uuid` | NO | -- | FK -> `destinations(id)` |
| `driver_id` | `uuid` | YES | `NULL` | FK -> `drivers(id)` |
| `ride_series_id` | `uuid` | YES | `NULL` | FK -> `ride_series(id)` |
| `date` | `date` | NO | -- | -- |
| `pickup_time` | `time` | NO | -- | -- |
| `direction` | `ride_direction` | NO | `'outbound'` | -- |
| `status` | `ride_status` | NO | `'unplanned'` | -- |
| `notes` | `text` | YES | `NULL` | -- |
| `is_active` | `boolean` | NO | `true` | -- |
| `created_at` | `timestamptz` | NO | `now()` | -- |
| `updated_at` | `timestamptz` | NO | `now()` | -- |

```sql
CREATE TABLE public.rides (
  id              uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      uuid            NOT NULL REFERENCES public.patients(id),
  destination_id  uuid            NOT NULL REFERENCES public.destinations(id),
  driver_id       uuid            REFERENCES public.drivers(id),
  ride_series_id  uuid            REFERENCES public.ride_series(id),
  date            date            NOT NULL,
  pickup_time     time            NOT NULL,
  direction       ride_direction  NOT NULL DEFAULT 'outbound',
  status          ride_status     NOT NULL DEFAULT 'unplanned',
  notes           text,
  is_active       boolean         NOT NULL DEFAULT true,
  created_at      timestamptz     NOT NULL DEFAULT now(),
  updated_at      timestamptz     NOT NULL DEFAULT now()
);
```

**Design notes:**
- `direction = 'both'` on a single ride means the driver does a round-trip (pick up, deliver, wait, return). The application layer can split a `both` direction into two separate ride rows if needed in the future -- but for MVP, dispatchers think in "Hinfahrt / Rueckfahrt / Hin und Rueck" per ride entry, so we keep it as a single row.
- `driver_id` is nullable: rides start as `unplanned` with no driver. Assignment happens during dispatch.
- `ride_series_id` is a soft backlink to the template that generated this ride. It is informational, not a live dependency. Deleting/deactivating a series does not cascade to existing rides.
- `status` starts at `unplanned` and follows the state machine (section 5).

---

### 2.7 `driver_availability`

Time blocks when a driver is available for dispatch.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `driver_id` | `uuid` | NO | -- | FK -> `drivers(id)` ON DELETE CASCADE |
| `day_of_week` | `day_of_week` | YES | `NULL` | -- |
| `specific_date` | `date` | YES | `NULL` | -- |
| `start_time` | `time` | NO | -- | -- |
| `end_time` | `time` | NO | -- | -- |
| `is_active` | `boolean` | NO | `true` | -- |
| `created_at` | `timestamptz` | NO | `now()` | -- |
| `updated_at` | `timestamptz` | NO | `now()` | -- |

```sql
CREATE TABLE public.driver_availability (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id      uuid         NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  day_of_week    day_of_week,
  specific_date  date,
  start_time     time         NOT NULL,
  end_time       time         NOT NULL,
  is_active      boolean      NOT NULL DEFAULT true,
  created_at     timestamptz  NOT NULL DEFAULT now(),
  updated_at     timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT time_range_valid CHECK (end_time > start_time),
  CONSTRAINT exactly_one_schedule_type CHECK (
    (day_of_week IS NOT NULL AND specific_date IS NULL)
    OR (day_of_week IS NULL AND specific_date IS NOT NULL)
  )
);
```

**Design notes:**
- Each row is either a **recurring weekly block** (has `day_of_week`, no `specific_date`) or a **date-specific override** (has `specific_date`, no `day_of_week`). The `exactly_one_schedule_type` constraint enforces this.
- A driver can have multiple blocks per day (e.g., 08:00-12:00 and 14:00-18:00).
- `ON DELETE CASCADE` from `drivers` is acceptable here because availability is meaningless without its driver.
- Overlap detection (two blocks for the same driver on the same day that overlap in time) is enforced at the application layer, not via a database constraint. Exclusion constraints on `(driver_id, day_of_week, tsrange)` are possible but add complexity. For MVP, application validation is sufficient.

---

### 2.8 `communication_log`

Stores communication events (calls, notes, messages) linked to a ride.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `ride_id` | `uuid` | NO | -- | FK -> `rides(id)` |
| `author_id` | `uuid` | NO | -- | FK -> `profiles(id)` |
| `message` | `text` | NO | -- | CHECK `length(message) > 0` |
| `created_at` | `timestamptz` | NO | `now()` | -- |

```sql
CREATE TABLE public.communication_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id     uuid        NOT NULL REFERENCES public.rides(id),
  author_id   uuid        NOT NULL REFERENCES public.profiles(id),
  message     text        NOT NULL CHECK (length(message) > 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

**Design notes:**
- No `updated_at` or `is_active` -- log entries are append-only and immutable. You do not edit or delete communication logs.
- No `updated_at` by design: if you said it, it stays said. This is an audit trail.
- `author_id` references `profiles` (not `auth.users`) so we can display the name without cross-schema joins.

---

## 3. Automatic `updated_at` Trigger

Every table with an `updated_at` column gets a trigger that sets it on UPDATE.

```sql
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to every table with updated_at:
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.destinations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ride_series
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.rides
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.driver_availability
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
```

---

## 4. Indexes

### Primary Access Patterns and Their Indexes

```sql
-- === rides ===
-- Dispatch board: "show me all rides for a given date"
CREATE INDEX idx_rides_date ON public.rides (date);

-- Dispatch board with status filter: "unplanned rides for today"
CREATE INDEX idx_rides_date_status ON public.rides (date, status);

-- Driver view: "my rides today"
CREATE INDEX idx_rides_driver_date ON public.rides (driver_id, date)
  WHERE driver_id IS NOT NULL;

-- Ride series link: "all rides from this series"
CREATE INDEX idx_rides_series ON public.rides (ride_series_id)
  WHERE ride_series_id IS NOT NULL;

-- Patient history: "all rides for this patient"
CREATE INDEX idx_rides_patient ON public.rides (patient_id);

-- Active rides only (used in most queries)
CREATE INDEX idx_rides_active ON public.rides (is_active)
  WHERE is_active = true;

-- === driver_availability ===
-- Schedule lookup: "who is available on Mondays?"
CREATE INDEX idx_availability_day ON public.driver_availability (day_of_week, start_time)
  WHERE day_of_week IS NOT NULL AND is_active = true;

-- Date-specific lookup: "who is available on 2026-03-15?"
CREATE INDEX idx_availability_date ON public.driver_availability (specific_date, start_time)
  WHERE specific_date IS NOT NULL AND is_active = true;

-- Driver's own schedule
CREATE INDEX idx_availability_driver ON public.driver_availability (driver_id);

-- === patients ===
-- Name search for autocomplete
CREATE INDEX idx_patients_name ON public.patients (last_name, first_name)
  WHERE is_active = true;

-- === drivers ===
-- Active driver list
CREATE INDEX idx_drivers_active ON public.drivers (last_name, first_name)
  WHERE is_active = true;

-- === destinations ===
-- Active destination list
CREATE INDEX idx_destinations_active ON public.destinations (name)
  WHERE is_active = true;

-- === ride_series ===
-- Active series for a patient
CREATE INDEX idx_ride_series_patient ON public.ride_series (patient_id)
  WHERE is_active = true;

-- === communication_log ===
-- Log entries for a ride (chronological)
CREATE INDEX idx_comm_log_ride ON public.communication_log (ride_id, created_at);

-- === profiles ===
-- Lookup profile by driver link
CREATE INDEX idx_profiles_driver ON public.profiles (driver_id)
  WHERE driver_id IS NOT NULL;
```

**Design notes:**
- Partial indexes (with `WHERE` clauses) are used extensively. Since most queries filter on `is_active = true` or `driver_id IS NOT NULL`, partial indexes keep the index small and fast.
- The composite index `idx_rides_date_status` covers the most common dispatch board query. PostgreSQL can also use this index for queries that filter only on `date` (leftmost prefix).
- No full-text search indexes for MVP. If patient/destination search needs to be fuzzy, we add `pg_trgm` indexes later.

---

## 5. Ride Status State Machine

This is the contract. The application layer enforces these transitions. No database trigger enforces them (that would be brittle and hard to debug), but the application MUST validate transitions before updating status.

### State Diagram

```
                         +-- rejected
                         |
  unplanned ---> planned ---> confirmed ---> in_progress ---> picked_up ---> arrived ---> completed
      |             |            |               |                |             |
      |             |            |               |                |             |
      +------+------+-----+-----+-------+-------+--------+-------+------+------+
             |             |             |                |              |
             v             v             v                v              v
         cancelled     cancelled     cancelled       no_show        cancelled
```

### Transition Table

| From | Allowed To | Trigger |
|------|-----------|---------|
| `unplanned` | `planned`, `cancelled` | Operator assigns driver / Operator cancels |
| `planned` | `confirmed`, `rejected`, `cancelled` | Driver confirms / Driver rejects / Operator cancels |
| `rejected` | `planned`, `cancelled` | Operator reassigns driver / Operator cancels |
| `confirmed` | `in_progress`, `cancelled` | Driver starts ride / Operator cancels |
| `in_progress` | `picked_up`, `no_show`, `cancelled` | Driver picks up patient / Patient not present / Operator cancels |
| `picked_up` | `arrived`, `cancelled` | Driver arrives at destination / Emergency cancel |
| `arrived` | `completed`, `cancelled` | Ride finished / Late cancel |
| `completed` | *(terminal)* | -- |
| `cancelled` | *(terminal)* | -- |
| `no_show` | *(terminal)* | -- |

### Transition Rules (Application Layer)

```typescript
// src/lib/rides/status-machine.ts

const VALID_TRANSITIONS: Record<RideStatus, RideStatus[]> = {
  unplanned:   ['planned', 'cancelled'],
  planned:     ['confirmed', 'rejected', 'cancelled'],
  rejected:    ['planned', 'cancelled'],
  confirmed:   ['in_progress', 'cancelled'],
  in_progress: ['picked_up', 'no_show', 'cancelled'],
  picked_up:   ['arrived', 'cancelled'],
  arrived:     ['completed', 'cancelled'],
  completed:   [],
  cancelled:   [],
  no_show:     [],
};

export function canTransition(from: RideStatus, to: RideStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}
```

**Design notes:**
- `rejected` is not terminal. When a driver rejects, the ride goes back to a state where a new driver can be assigned (`planned` with a different driver). This is the most common dispatch workflow: "Driver A can't do it, reassign to Driver B."
- `cancelled` can be reached from any non-terminal state. Cancellations happen for many reasons (patient cancels, vehicle breakdown, weather).
- `no_show` is terminal. If the patient wasn't there, the ride is over. A new ride must be created if rescheduled.
- We do NOT enforce transitions via database triggers because: (a) trigger logic is harder to test, (b) trigger errors produce cryptic messages for the frontend, (c) application-level validation can return user-friendly error messages. The state machine is documented and tested as a pure function.

---

## 6. Row Level Security (RLS) Policies

### 6.0 Helper Function

All RLS policies rely on looking up the current user's role from `profiles`. We create a helper function to avoid repeating this logic.

```sql
-- Returns the role of the currently authenticated user
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles
  WHERE id = auth.uid() AND is_active = true;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Returns the driver_id linked to the current user (NULL if not a driver)
CREATE OR REPLACE FUNCTION public.get_user_driver_id()
RETURNS uuid AS $$
  SELECT driver_id FROM public.profiles
  WHERE id = auth.uid() AND is_active = true;
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

**SECURITY DEFINER** is used so these functions execute with the definer's permissions and can read `profiles` regardless of RLS on that table. The functions are `STABLE` (no side effects, same result within a transaction) so PostgreSQL can cache the result per-statement.

### 6.1 Enable RLS on All Tables

```sql
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_log ENABLE ROW LEVEL SECURITY;
```

### 6.2 Policy Definitions

#### `profiles`

```sql
-- Users can read their own profile
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT USING (id = auth.uid());

-- Admins and operators can read all profiles
CREATE POLICY profiles_select_staff ON public.profiles
  FOR SELECT USING (public.get_user_role() IN ('admin', 'operator'));

-- Only admins can insert/update profiles (user creation is admin-only)
CREATE POLICY profiles_insert_admin ON public.profiles
  FOR INSERT WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY profiles_update_admin ON public.profiles
  FOR UPDATE USING (public.get_user_role() = 'admin');
```

#### `patients`

```sql
-- Admins and operators: full read access
CREATE POLICY patients_select_staff ON public.patients
  FOR SELECT USING (public.get_user_role() IN ('admin', 'operator'));

-- Drivers: can read only patients assigned to their rides (name only enforced via views/API)
-- NOTE: RLS gives row-level access. Column-level restriction is enforced
-- at the application layer (Server Components / API) by selecting only
-- first_name and last_name for driver queries. See section 6.3.
CREATE POLICY patients_select_driver ON public.patients
  FOR SELECT USING (
    public.get_user_role() = 'driver'
    AND id IN (
      SELECT patient_id FROM public.rides
      WHERE driver_id = public.get_user_driver_id()
        AND is_active = true
    )
  );

-- Only admins and operators can insert/update patients
CREATE POLICY patients_insert_staff ON public.patients
  FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'operator'));

CREATE POLICY patients_update_staff ON public.patients
  FOR UPDATE USING (public.get_user_role() IN ('admin', 'operator'));
```

#### `drivers`

```sql
-- Admins and operators: full read access
CREATE POLICY drivers_select_staff ON public.drivers
  FOR SELECT USING (public.get_user_role() IN ('admin', 'operator'));

-- Drivers can read their own driver record
CREATE POLICY drivers_select_own ON public.drivers
  FOR SELECT USING (
    public.get_user_role() = 'driver'
    AND id = public.get_user_driver_id()
  );

-- Only admins and operators can insert/update drivers
CREATE POLICY drivers_insert_staff ON public.drivers
  FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'operator'));

CREATE POLICY drivers_update_staff ON public.drivers
  FOR UPDATE USING (public.get_user_role() IN ('admin', 'operator'));
```

#### `destinations`

```sql
-- All authenticated users can read destinations (needed for ride display)
CREATE POLICY destinations_select_all ON public.destinations
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only admins and operators can insert/update destinations
CREATE POLICY destinations_insert_staff ON public.destinations
  FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'operator'));

CREATE POLICY destinations_update_staff ON public.destinations
  FOR UPDATE USING (public.get_user_role() IN ('admin', 'operator'));
```

#### `ride_series`

```sql
-- Only admins and operators can access ride series (drivers don't need series info)
CREATE POLICY ride_series_select_staff ON public.ride_series
  FOR SELECT USING (public.get_user_role() IN ('admin', 'operator'));

CREATE POLICY ride_series_insert_staff ON public.ride_series
  FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'operator'));

CREATE POLICY ride_series_update_staff ON public.ride_series
  FOR UPDATE USING (public.get_user_role() IN ('admin', 'operator'));
```

#### `rides`

```sql
-- Admins and operators: full read access
CREATE POLICY rides_select_staff ON public.rides
  FOR SELECT USING (public.get_user_role() IN ('admin', 'operator'));

-- Drivers: can only see their assigned rides
CREATE POLICY rides_select_driver ON public.rides
  FOR SELECT USING (
    public.get_user_role() = 'driver'
    AND driver_id = public.get_user_driver_id()
  );

-- Only admins and operators can create rides
CREATE POLICY rides_insert_staff ON public.rides
  FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'operator'));

-- Admins and operators can update any ride
CREATE POLICY rides_update_staff ON public.rides
  FOR UPDATE USING (public.get_user_role() IN ('admin', 'operator'));

-- Drivers can update only their assigned rides (for status changes)
CREATE POLICY rides_update_driver ON public.rides
  FOR UPDATE USING (
    public.get_user_role() = 'driver'
    AND driver_id = public.get_user_driver_id()
  );
```

#### `driver_availability`

```sql
-- Admins and operators: full read/write access
CREATE POLICY availability_select_staff ON public.driver_availability
  FOR SELECT USING (public.get_user_role() IN ('admin', 'operator'));

CREATE POLICY availability_insert_staff ON public.driver_availability
  FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'operator'));

CREATE POLICY availability_update_staff ON public.driver_availability
  FOR UPDATE USING (public.get_user_role() IN ('admin', 'operator'));

-- Drivers can read their own availability
CREATE POLICY availability_select_own ON public.driver_availability
  FOR SELECT USING (
    public.get_user_role() = 'driver'
    AND driver_id = public.get_user_driver_id()
  );
```

#### `communication_log`

```sql
-- Admins and operators: full read access
CREATE POLICY comm_log_select_staff ON public.communication_log
  FOR SELECT USING (public.get_user_role() IN ('admin', 'operator'));

-- Drivers: can read logs for their assigned rides
CREATE POLICY comm_log_select_driver ON public.communication_log
  FOR SELECT USING (
    public.get_user_role() = 'driver'
    AND ride_id IN (
      SELECT id FROM public.rides
      WHERE driver_id = public.get_user_driver_id()
        AND is_active = true
    )
  );

-- All authenticated users can insert log entries
CREATE POLICY comm_log_insert_auth ON public.communication_log
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND author_id = auth.uid()
  );
```

### 6.3 Column-Level Data Minimization for Drivers

PostgreSQL RLS operates at the row level, not the column level. To enforce the requirement that drivers see only patient names (not phone, address, notes), we enforce this at the **application layer**:

1. **Server Components** that serve driver views query only `first_name, last_name` from `patients`.
2. **Server Actions** for driver operations return only the allowed columns.
3. The Supabase client query in driver-facing code is:
   ```typescript
   // Driver ride view -- minimal patient data
   supabase
     .from('rides')
     .select(`
       id, date, pickup_time, direction, status, notes,
       patient:patients(first_name, last_name),
       destination:destinations(name, street, house_number, postal_code, city, department)
     `)
     .eq('driver_id', driverProfile.driver_id)
   ```
4. RLS ensures a driver cannot bypass this by querying `patients` directly -- they can only see patients linked to their rides (policy `patients_select_driver`). Even if they query all columns, they only get rows they are entitled to.
5. For defense-in-depth, a future enhancement could add a `patients_driver_view` database view that exposes only name columns and grant drivers access only through that view. Deferred for MVP.

### 6.4 No DELETE Policies

No table has a `DELETE` policy. All deactivation is done via `UPDATE` setting `is_active = false`. This is enforced by the absence of any `FOR DELETE` RLS policy -- any `DELETE` statement will be denied by RLS.

---

## 7. Entity Relationship Diagram

```
┌──────────────────┐
│   auth.users     │
│   (Supabase)     │
└────────┬─────────┘
         │ 1:1
         v
┌──────────────────┐       ┌──────────────────┐
│    profiles      │       │    drivers        │
│                  │──────>│                   │
│  role            │ 0..1  │  vehicle_type     │
│  display_name    │       │  first/last_name  │
│  driver_id (FK)  │       │  phone            │
└──────────────────┘       └────────┬──────────┘
                                    │ 1:N
                                    v
                           ┌──────────────────┐
                           │ driver_           │
                           │ availability      │
                           │                   │
                           │ day_of_week       │
                           │ specific_date     │
                           │ start/end_time    │
                           └──────────────────┘

┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│    patients      │       │      rides       │       │  destinations    │
│                  │<──────│                  │──────>│                  │
│  first/last_name │  N:1  │  date            │  N:1  │  name            │
│  phone           │       │  pickup_time     │       │  type            │
│  address fields  │       │  direction       │       │  address fields  │
│  mobility flags  │       │  status          │       │  department      │
└──────────────────┘       │  driver_id (FK) ─────────> drivers
                           │  series_id (FK) ──┐      └──────────────────┘
                           └────────┬──────────┘
                                    │         │
                                    │ 1:N     v
                                    │  ┌──────────────────┐
                                    │  │   ride_series    │
                                    │  │                  │
                                    │  │  recurrence_type │
                                    │  │  days_of_week[]  │
                                    │  │  pickup_time     │
                                    │  │  start/end_date  │
                                    │  │  patient_id (FK) │
                                    │  │  dest_id (FK)    │
                                    │  └──────────────────┘
                                    v
                           ┌──────────────────┐
                           │ communication_   │
                           │ log              │
                           │                  │
                           │  message         │
                           │  author_id (FK)  │
                           └──────────────────┘
```

---

## 8. Role-Permission Matrix

| Resource | Action | Admin | Operator | Driver |
|----------|--------|:-----:|:--------:|:------:|
| **profiles** | Read all | Yes | Yes | Own only |
| **profiles** | Create | Yes | No | No |
| **profiles** | Update | Yes | No | No |
| **patients** | Read all | Yes | Yes | No |
| **patients** | Read (name only, via ride) | Yes | Yes | Yes |
| **patients** | Create | Yes | Yes | No |
| **patients** | Update | Yes | Yes | No |
| **drivers** | Read all | Yes | Yes | No |
| **drivers** | Read own | Yes | Yes | Yes |
| **drivers** | Create | Yes | Yes | No |
| **drivers** | Update | Yes | Yes | No |
| **destinations** | Read | Yes | Yes | Yes |
| **destinations** | Create | Yes | Yes | No |
| **destinations** | Update | Yes | Yes | No |
| **rides** | Read all | Yes | Yes | No |
| **rides** | Read assigned | Yes | Yes | Yes |
| **rides** | Create | Yes | Yes | No |
| **rides** | Update all | Yes | Yes | No |
| **rides** | Update assigned (status) | Yes | Yes | Yes |
| **ride_series** | Read | Yes | Yes | No |
| **ride_series** | Create | Yes | Yes | No |
| **ride_series** | Update | Yes | Yes | No |
| **driver_availability** | Read all | Yes | Yes | No |
| **driver_availability** | Read own | Yes | Yes | Yes |
| **driver_availability** | Create | Yes | Yes | No |
| **driver_availability** | Update | Yes | Yes | No |
| **communication_log** | Read (by ride) | Yes | Yes | Assigned rides |
| **communication_log** | Create | Yes | Yes | Yes |

---

## 9. Profile Creation on Signup

Since signups are admin-only (no self-registration), the profile is created by an admin via a Server Action. However, we also install a database trigger to auto-create a minimal profile when a new `auth.users` row appears (as a safety net for edge cases like direct Supabase Auth API calls).

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.email),
    COALESCE(
      (NEW.raw_user_meta_data ->> 'role')::user_role,
      'operator'
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

**Design note:** The `ON CONFLICT DO NOTHING` prevents errors if the admin pre-creates the profile before the auth user confirm step completes.

---

## 10. Migration File Order

The SQL migration should be created in this order due to foreign key dependencies:

1. Enum types (all 7)
2. `drivers` table (no FKs to other domain tables)
3. `patients` table (no FKs to other domain tables)
4. `destinations` table (no FKs to other domain tables)
5. `profiles` table (FK to `auth.users` and `drivers`)
6. `ride_series` table (FK to `patients` and `destinations`)
7. `rides` table (FK to `patients`, `destinations`, `drivers`, `ride_series`)
8. `driver_availability` table (FK to `drivers`)
9. `communication_log` table (FK to `rides` and `profiles`)
10. `handle_updated_at` function and triggers
11. Indexes
12. RLS enable + policies
13. `handle_new_user` function and trigger

All in a single migration file: `supabase/migrations/20260218_000001_initial_schema.sql`

---

## 11. Design Decisions and Trade-offs

### Decision: Single `rides` table, no `ride_legs` split

**Context:** A "Hin und Rueck" ride could be modeled as two separate leg rows. We chose a single row with `direction = 'both'`.

**Rationale:** Dispatchers think in terms of "one task" for a round trip. Splitting introduces complexity in linking legs, ensuring they have the same driver, and displaying them. If scheduling complexity increases (different drivers for outbound/return), we split then. The migration path is straightforward: add a `ride_legs` table and create two legs per existing `both` ride.

### Decision: No `vehicles` table

**Context:** Vehicles could be a separate entity with their own availability and type.

**Rationale:** In the current operation, one driver = one vehicle. The vehicle type is a property of the driver. If the operation grows to have vehicle pools, we add a `vehicles` table and move `vehicle_type` there. Clean migration path, no premature abstraction.

### Decision: State machine in application, not database

**Context:** We could enforce status transitions via a trigger.

**Rationale:** Application-layer enforcement gives better error messages, is easier to test (pure function), and is more visible to developers. The state machine is documented as a contract and tested with unit tests. Database triggers for business logic are a maintenance burden.

### Decision: `day_of_week` enum array on `ride_series` instead of junction table

**Context:** Many-to-many relationship between series and days could use a junction table.

**Rationale:** The set of days is small (max 7), owned entirely by the series, and never queried independently. An array is the right PostgreSQL primitive here. It is queryable (`WHERE days_of_week @> ARRAY['monday']::day_of_week[]`) and simpler than a junction table.

### Decision: No audit/history table for MVP

**Context:** Full audit logging (who changed what, when) is valuable for a dispatch system.

**Rationale:** The `updated_at` field plus the `communication_log` cover the MVP needs. A full audit table (using triggers to log every INSERT/UPDATE with old and new values) is a post-MVP enhancement. When added, we will use a generic `audit_log` table with JSONB columns for old/new values, triggered on all tables. This does not require schema changes to existing tables.

### Decision: Soft deletes only

**Context:** Hard deletes lose data and break referential integrity.

**Rationale:** `is_active = false` preserves history and allows undo. All queries must include `WHERE is_active = true` -- this is enforced by convention and partial indexes. The partial indexes also mean inactive rows do not slow down active queries.

---

## Consequences

### Positive
- Clean, normalized schema with clear ownership boundaries
- RLS policies enforce security at the database level -- even if application code has bugs, data cannot leak
- Explicit state machine prevents hidden status logic
- Soft deletes preserve all data for audit and recovery
- Partial indexes keep performance optimal for the common case (active records)
- Schema is extensible: vehicles table, audit log, and ride legs can be added without breaking changes

### Negative
- `get_user_role()` function is called on every query via RLS -- must be monitored for performance. The `STABLE` marker helps PostgreSQL cache it, but under high concurrent load this could become a bottleneck. Mitigation: the function is a single-row lookup by PK, which is effectively free.
- Column-level data minimization for drivers relies on application discipline, not database enforcement. Mitigation: documented pattern, code review, and potential future database view.
- No full audit trail for MVP. Mitigation: `updated_at` and `communication_log` cover the most critical cases; full audit is planned for post-MVP.

### Risks
- Enum types are hard to modify (adding values is easy, removing/renaming is hard). Mitigation: we chose enums for truly stable value sets.
- Recurring ride generation needs an external process (cron job or Supabase Edge Function). The schema supports it, but the generation logic is not defined here.
- RLS policies with subqueries (e.g., `patients_select_driver`) may have performance implications at scale. Mitigation: the subquery is on indexed columns and bounded by driver assignment count.

---

## References

- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Enum Types](https://www.postgresql.org/docs/current/datatype-enum.html)
- ADR-001: Project Bootstrap
