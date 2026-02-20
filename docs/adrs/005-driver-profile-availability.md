# ADR 005: Fahrerprofil & Verfuegbarkeitsmodell (M4)

## Status

Accepted

## Date

2026-02-19

## Context

Das aktuelle `drivers`-Schema hat nur Minimalfelder (Vorname, Nachname, Telefon, Fahrzeugtyp, Notizen). Fuer den Schweizer Fahrdienst-Betrieb werden erweiterte Fahrerinformationen benoetigt: Adresse mit CH-PLZ, Fahrzeug-Details, Fahrausweis, Notfallkontakt. Gleichzeitig muss das bisherige flexible Verfuegbarkeitsmodell (`driver_availability` mit beliebigen start_time/end_time) auf ein festes 2-Stunden-Slot-Raster umgestellt werden, bei dem Fahrer ihre eigene Verfuegbarkeit pflegen koennen.

### Offene Fachentscheidungen (aus Issue-Analyse)

Sechs Punkte wurden im Vorfeld als klaerungs-beduerftig identifiziert. Die Entscheidungen dazu sind unten dokumentiert.

---

## Fachentscheid 1: vehicle_type vs. vehicle + driving_license

### Entscheidung

`vehicle_type` (Enum: standard/wheelchair/stretcher) **bleibt bestehen** -- es beschreibt die Faehigkeit des Fahrers/Fahrzeugs und wird fuer die Zuweisungslogik gebraucht.

**Zusaetzlich** kommen zwei neue Freitext-Felder:
- `vehicle` (text, optional) -- Fahrzeugbeschreibung (z.B. "VW Caddy Maxi, ZH 123456")
- `driving_license` (text, optional) -- Fahrausweis-Kategorie/Nummer (z.B. "B, Nr. 1234567")

### Begruendung

Das Enum `vehicle_type` hat semantische Bedeutung fuer die Ride-Zuweisungslogik (Rollstuhl-Patient braucht Rollstuhl-Fahrzeug). Die neuen Freitext-Felder sind operativ nuetzlich, haben aber keine Business-Logik-Relevanz. Umbenennung oder Entfernung des Enums wuerde Ride-Logik brechen.

---

## Fachentscheid 2: Slot-Modell -- bestehende Tabelle anpassen

### Entscheidung

**Option a): Bestehende `driver_availability`-Tabelle anpassen** mit verschaerften CHECK-Constraints.

Kein Tabellen-Neubau, keine Migration bestehender Daten (da noch keine produktiven Daten vorhanden).

### Aenderungen an der Tabelle

1. **Neuer CHECK-Constraint** `valid_slot_times`: `start_time` muss in `(08:00, 10:00, 12:00, 14:00, 16:00)` liegen, `end_time = start_time + interval '2 hours'`
2. **Neuer CHECK-Constraint** `weekday_only`: Wenn `day_of_week IS NOT NULL`, dann nur `monday` bis `friday` (kein `saturday`/`sunday`)
3. **UNIQUE-Constraint** auf `(driver_id, day_of_week, start_time)` WHERE `day_of_week IS NOT NULL` -- verhindert doppelte Slots
4. **UNIQUE-Constraint** auf `(driver_id, specific_date, start_time)` WHERE `specific_date IS NOT NULL`
5. `is_active`-Spalte **entfaellt** zugunsten von echtem DELETE -- Slots sind atomar, Soft-Delete hat keinen fachlichen Nutzen
6. `updated_at`-Spalte **entfaellt** -- Slots werden nur erstellt oder geloescht, nie aktualisiert

### Begruendung

Pre-MVP: keine produktiven Daten, kein Migrations-Risiko. Eine neue Tabelle wuerde die bestehende Tabelle als Dead Code hinterlassen. Anpassen ist einfacher und sauberer.

---

## Fachentscheid 3: specific_date -- beibehalten

### Entscheidung

Die `specific_date`-Spalte und der `exactly_one_schedule_type`-Constraint **bleiben bestehen**. M4 implementiert die UI nur fuer das Wochenraster (`day_of_week`). Die datumsspezifische Funktionalitaet wird in einem spaeteren Milestone umgesetzt.

### Begruendung

Kein Grund, eine nuetzliche Erweiterungsmoeglichkeit zu entfernen. Die CHECK-Constraints und UNIQUE-Constraints gelten sowohl fuer day_of_week als auch specific_date.

---

## Fachentscheid 4: Replace-All fuer Availability -- DELETE-Policy

### Entscheidung

**Ja**, sowohl Fahrer als auch Staff erhalten eine DELETE-Policy auf `driver_availability`.

- **Staff (admin, operator)**: DELETE auf alle Eintraege
- **Fahrer**: DELETE nur auf eigene Eintraege (`driver_id = get_user_driver_id()`)

Die Verfuegbarkeit wird per **Replace-All-Strategie** aktualisiert: alle bestehenden Wochenraster-Slots des Fahrers loeschen, dann die neuen Slots einfuegen. Das ist einfacher und weniger fehleranfaellig als Diff-basierte Updates.

### Begruendung

Analog zum `patient_impairments`-Pattern (ADR-003). Slots sind atomar -- es gibt keinen fachlichen Grund, einzelne Slots zu "updaten" statt replace-all zu verwenden.

---

## Fachentscheid 5: Verfuegbarkeitsplaner-Route

### Entscheidung

**Eigener Reiter auf der Fahrer-Detail-Seite**, erreichbar unter `/drivers/[id]/availability`.

Kein separater Top-Level-Nav-Eintrag. Zugang fuer Staff: Fahrerliste -> Fahrer -> Verfuegbarkeit. Zugang fuer Fahrer: ueber ein eigenes Dashboard-Element (spaeterer Milestone, M4 liefert nur die Staff-Perspektive und die Server Actions).

### Begruendung

Verfuegbarkeit gehoert fachlich zum Fahrer. Eine separate Top-Level-Route wuerde die Navigation ueberladen. Der Tab-Ansatz folgt dem REST-Ressourcenmodell (`/drivers/:id/availability`).

---

## Fachentscheid 6: Fahrer-Selbstverwaltung

### Entscheidung

In M4: **Fahrer koennen nur ihre eigene Verfuegbarkeit pflegen**, nicht ihr Profil (Adresse etc.). Profilpflege durch Fahrer wird als separater Milestone betrachtet. Die RLS-Policies fuer Fahrer bleiben auf `drivers`-Tabelle bei SELECT only.

### Begruendung

Profil-Selbstverwaltung erfordert UI-Entscheidungen (welche Felder darf ein Fahrer aendern, welche nicht?), die M4 ueberladen wuerden. Verfuegbarkeit ist der dringendere Use Case.

---

## Implementierungsplan

### Uebersicht der Schritte

| Schritt | Issue | Beschreibung |
|---------|-------|--------------|
| 1 | #11 | ADR erstellen (dieses Dokument) |
| 2 | #12 | DB-Migration: Fahrerfelder erweitern |
| 3 | #13 | DB-Migration: Verfuegbarkeit auf 2h-Slots |
| 4 | #14 | RLS-Policies fuer Fahrer-Verfuegbarkeit |
| 5 | #15 | Zod-Schemas + Server Actions |
| 6 | #16 | UI: Fahrerformular und Fahrertabelle erweitern |
| 7 | #17 | UI: Verfuegbarkeitsplaner (Wochenraster) |
| 8 | #18 | Tests und Verifikation |

---

### Schritt 2: DB-Migration -- Fahrerfelder erweitern (#12)

**Neue Datei:** `supabase/migrations/20260223_000001_driver_profile_ch.sql`

```sql
-- M4 Step 2: Driver Profile -- Swiss Requirements
-- Adds address fields, vehicle description, driving license, emergency contact.

-- =============================================================
-- 2a: Address fields on drivers
-- =============================================================

ALTER TABLE public.drivers
  ADD COLUMN street         text,
  ADD COLUMN house_number   text,
  ADD COLUMN postal_code    text,
  ADD COLUMN city           text;

-- CH postal code: 4 digits when set
ALTER TABLE public.drivers
  ADD CONSTRAINT drivers_postal_code_ch
  CHECK (postal_code IS NULL OR postal_code ~ '^\d{4}$');

-- =============================================================
-- 2b: Vehicle description and driving license
-- =============================================================

ALTER TABLE public.drivers
  ADD COLUMN vehicle          text,
  ADD COLUMN driving_license  text;

-- Max length constraints
ALTER TABLE public.drivers
  ADD CONSTRAINT drivers_vehicle_max_length
  CHECK (vehicle IS NULL OR length(vehicle) <= 200);

ALTER TABLE public.drivers
  ADD CONSTRAINT drivers_driving_license_max_length
  CHECK (driving_license IS NULL OR length(driving_license) <= 100);

-- =============================================================
-- 2c: Emergency contact fields
-- =============================================================

ALTER TABLE public.drivers
  ADD COLUMN emergency_contact_name   text,
  ADD COLUMN emergency_contact_phone  text;

ALTER TABLE public.drivers
  ADD CONSTRAINT drivers_emergency_contact_name_max
  CHECK (emergency_contact_name IS NULL OR length(emergency_contact_name) <= 200);

ALTER TABLE public.drivers
  ADD CONSTRAINT drivers_emergency_contact_phone_max
  CHECK (emergency_contact_phone IS NULL OR length(emergency_contact_phone) <= 50);

-- =============================================================
-- 2d: Max length for existing fields (safety net)
-- =============================================================

ALTER TABLE public.drivers
  ADD CONSTRAINT drivers_street_max_length
  CHECK (street IS NULL OR length(street) <= 200);

ALTER TABLE public.drivers
  ADD CONSTRAINT drivers_house_number_max_length
  CHECK (house_number IS NULL OR length(house_number) <= 20);

ALTER TABLE public.drivers
  ADD CONSTRAINT drivers_city_max_length
  CHECK (city IS NULL OR length(city) <= 100);

ALTER TABLE public.drivers
  ADD CONSTRAINT drivers_phone_max_length
  CHECK (phone IS NULL OR length(phone) <= 50);

ALTER TABLE public.drivers
  ADD CONSTRAINT drivers_notes_max_length
  CHECK (notes IS NULL OR length(notes) <= 1000);
```

**TypeScript-DB-Typen aktualisieren:** `src/lib/types/database.ts`

Aenderung im `drivers`-Block:

```typescript
drivers: {
  Row: {
    city: string | null
    created_at: string
    driving_license: string | null
    emergency_contact_name: string | null
    emergency_contact_phone: string | null
    first_name: string
    house_number: string | null
    id: string
    is_active: boolean
    last_name: string
    notes: string | null
    phone: string | null
    postal_code: string | null
    street: string | null
    updated_at: string
    vehicle: string | null
    vehicle_type: Database["public"]["Enums"]["vehicle_type"]
  }
  Insert: {
    city?: string | null
    created_at?: string
    driving_license?: string | null
    emergency_contact_name?: string | null
    emergency_contact_phone?: string | null
    first_name: string
    house_number?: string | null
    id?: string
    is_active?: boolean
    last_name: string
    notes?: string | null
    phone?: string | null
    postal_code?: string | null
    street?: string | null
    updated_at?: string
    vehicle?: string | null
    vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
  }
  Update: {
    city?: string | null
    created_at?: string
    driving_license?: string | null
    emergency_contact_name?: string | null
    emergency_contact_phone?: string | null
    first_name?: string
    house_number?: string | null
    id?: string
    is_active?: boolean
    last_name?: string
    notes?: string | null
    phone?: string | null
    postal_code?: string | null
    street?: string | null
    updated_at?: string
    vehicle?: string | null
    vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
  }
  Relationships: []
}
```

**Verifikation Schritt 2:**
- `supabase db reset` laeuft fehlerfrei
- In Supabase Studio: `drivers`-Tabelle zeigt alle neuen Spalten
- INSERT mit `postal_code = '123'` wird abgewiesen (CHECK)
- INSERT mit `postal_code = '8001'` wird akzeptiert
- INSERT mit `vehicle` > 200 Zeichen wird abgewiesen

---

### Schritt 3: DB-Migration -- Verfuegbarkeit auf 2h-Slots (#13)

**Neue Datei:** `supabase/migrations/20260223_000002_availability_fixed_slots.sql`

```sql
-- M4 Step 3: Convert driver_availability to fixed 2h slot model
-- Pre-MVP: no production data, safe to alter constraints directly.

-- =============================================================
-- 3a: Drop old constraints that conflict with new model
-- =============================================================

-- Drop the old generic time range check
ALTER TABLE public.driver_availability
  DROP CONSTRAINT time_range_valid;

-- =============================================================
-- 3b: Drop is_active and updated_at (slots are create/delete only)
-- =============================================================

-- Drop the updated_at trigger first
DROP TRIGGER IF EXISTS set_updated_at ON public.driver_availability;

ALTER TABLE public.driver_availability
  DROP COLUMN is_active,
  DROP COLUMN updated_at;

-- =============================================================
-- 3c: Add fixed slot constraints
-- =============================================================

-- Only allowed start times (08, 10, 12, 14, 16) with exactly 2h duration
ALTER TABLE public.driver_availability
  ADD CONSTRAINT valid_slot_start_time
  CHECK (start_time IN ('08:00:00', '10:00:00', '12:00:00', '14:00:00', '16:00:00'));

ALTER TABLE public.driver_availability
  ADD CONSTRAINT valid_slot_duration
  CHECK (end_time = start_time + interval '2 hours');

-- Weekday only (no saturday/sunday) for day_of_week entries
ALTER TABLE public.driver_availability
  ADD CONSTRAINT weekday_only
  CHECK (day_of_week IS NULL OR day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday'));

-- =============================================================
-- 3d: Unique constraints to prevent duplicate slots
-- =============================================================

-- One slot per driver per weekday per time
CREATE UNIQUE INDEX idx_availability_unique_weekly
  ON public.driver_availability (driver_id, day_of_week, start_time)
  WHERE day_of_week IS NOT NULL;

-- One slot per driver per specific date per time
CREATE UNIQUE INDEX idx_availability_unique_date
  ON public.driver_availability (driver_id, specific_date, start_time)
  WHERE specific_date IS NOT NULL;

-- =============================================================
-- 3e: Update existing indexes (adjust for removed is_active)
-- =============================================================

DROP INDEX IF EXISTS public.idx_availability_day;
DROP INDEX IF EXISTS public.idx_availability_date;

CREATE INDEX idx_availability_day ON public.driver_availability (day_of_week, start_time)
  WHERE day_of_week IS NOT NULL;

CREATE INDEX idx_availability_date ON public.driver_availability (specific_date, start_time)
  WHERE specific_date IS NOT NULL;
```

**TypeScript-DB-Typen aktualisieren:** `src/lib/types/database.ts`

Aenderung im `driver_availability`-Block (`is_active` und `updated_at` entfernt):

```typescript
driver_availability: {
  Row: {
    created_at: string
    day_of_week: Database["public"]["Enums"]["day_of_week"] | null
    driver_id: string
    end_time: string
    id: string
    specific_date: string | null
    start_time: string
  }
  Insert: {
    created_at?: string
    day_of_week?: Database["public"]["Enums"]["day_of_week"] | null
    driver_id: string
    end_time: string
    id?: string
    specific_date?: string | null
    start_time: string
  }
  Update: {
    created_at?: string
    day_of_week?: Database["public"]["Enums"]["day_of_week"] | null
    driver_id?: string
    end_time?: string
    id?: string
    specific_date?: string | null
    start_time?: string
  }
  Relationships: [
    {
      foreignKeyName: "driver_availability_driver_id_fkey"
      columns: ["driver_id"]
      isOneToOne: false
      referencedRelation: "drivers"
      referencedColumns: ["id"]
    },
  ]
}
```

**Verifikation Schritt 3:**
- `supabase db reset` laeuft fehlerfrei
- INSERT mit `start_time = '09:00'` wird abgewiesen
- INSERT mit `start_time = '08:00', end_time = '10:00'` wird akzeptiert
- INSERT mit `start_time = '08:00', end_time = '11:00'` wird abgewiesen (Dauer != 2h)
- INSERT mit `day_of_week = 'saturday'` wird abgewiesen
- Doppelter INSERT (gleicher Fahrer, gleicher Tag, gleiche Zeit) wird abgewiesen (UNIQUE)
- `is_active`- und `updated_at`-Spalten existieren nicht mehr

---

### Schritt 4: RLS-Policies fuer Fahrer-Verfuegbarkeit (#14)

**Neue Datei:** `supabase/migrations/20260223_000003_availability_rls_driver.sql`

```sql
-- M4 Step 4: Add RLS policies for driver self-service availability
-- + DELETE policies for replace-all strategy

-- =============================================================
-- 4a: Driver can INSERT own availability slots
-- =============================================================

CREATE POLICY availability_insert_driver ON public.driver_availability
  FOR INSERT WITH CHECK (
    public.get_user_role() = 'driver'
    AND driver_id = public.get_user_driver_id()
  );

-- =============================================================
-- 4b: DELETE policies (replace-all strategy)
-- =============================================================

-- Staff can delete any availability
CREATE POLICY availability_delete_staff ON public.driver_availability
  FOR DELETE USING (
    public.get_user_role() IN ('admin', 'operator')
  );

-- Driver can delete own availability
CREATE POLICY availability_delete_driver ON public.driver_availability
  FOR DELETE USING (
    public.get_user_role() = 'driver'
    AND driver_id = public.get_user_driver_id()
  );
```

**Vollstaendige RLS-Policy-Matrix nach Schritt 4:**

| Operation | Staff (admin/operator) | Driver (eigene) | Driver (fremde) |
|-----------|----------------------|-----------------|-----------------|
| SELECT    | Alle (bestehend)     | Eigene (bestehend) | Nein |
| INSERT    | Alle (bestehend)     | Eigene (**NEU**)   | Nein |
| UPDATE    | Alle (bestehend)     | Nein (nicht noetig bei replace-all) | Nein |
| DELETE    | Alle (**NEU**)       | Eigene (**NEU**)   | Nein |

**Begruendung kein UPDATE fuer Fahrer:** Die Replace-All-Strategie loescht alle bestehenden Slots und fuegt die neuen ein. Ein UPDATE wuerde nur Komplexitaet hinzufuegen. Staff hat UPDATE fuer manuelle Korrekturen, aber im normalen Betrieb wird auch Replace-All verwendet.

**Verifikation Schritt 4:**
- Als Disponent: INSERT/DELETE auf beliebige Fahrer-Verfuegbarkeit geht
- Als Fahrer: INSERT/DELETE auf eigene Verfuegbarkeit geht
- Als Fahrer: INSERT mit `driver_id` eines anderen Fahrers wird abgewiesen
- Als Fahrer: DELETE auf fremde Verfuegbarkeit wird ignoriert (0 Rows affected)

---

### Schritt 5: Zod-Schemas + Server Actions (#15)

#### 5a: Zod-Schema fuer Fahrerprofil erweitern

**Aendern:** `src/lib/validations/drivers.ts`

```typescript
import { z } from "zod"

const emptyToNull = (v: string) => (v === "" ? null : v)

export const driverSchema = z.object({
  first_name: z.string().min(1, "Vorname ist erforderlich").max(100),
  last_name: z.string().min(1, "Nachname ist erforderlich").max(100),
  phone: z
    .string()
    .max(50)
    .transform(emptyToNull)
    .nullable()
    .optional(),
  vehicle_type: z.enum(["standard", "wheelchair", "stretcher"]).default("standard"),
  // Adresse -- erforderlich im Zod, DB erlaubt NULL fuer Altdaten
  street: z.string().min(1, "Strasse ist erforderlich").max(200),
  house_number: z.string().min(1, "Hausnummer ist erforderlich").max(20),
  postal_code: z
    .string()
    .min(1, "PLZ ist erforderlich")
    .regex(/^\d{4}$/, "PLZ muss 4-stellig sein (CH)"),
  city: z.string().min(1, "Ort ist erforderlich").max(100),
  // Fahrzeug / Fahrausweis -- optional
  vehicle: z
    .string()
    .max(200)
    .transform(emptyToNull)
    .nullable()
    .optional(),
  driving_license: z
    .string()
    .max(100)
    .transform(emptyToNull)
    .nullable()
    .optional(),
  // Notfallkontakt -- optional
  emergency_contact_name: z
    .string()
    .max(200)
    .transform(emptyToNull)
    .nullable()
    .optional(),
  emergency_contact_phone: z
    .string()
    .max(50)
    .transform(emptyToNull)
    .nullable()
    .optional(),
  notes: z
    .string()
    .max(1000)
    .transform(emptyToNull)
    .nullable()
    .optional(),
})

export type DriverFormValues = z.infer<typeof driverSchema>
```

#### 5b: Zod-Schema fuer Verfuegbarkeits-Slots

**Neue Datei:** `src/lib/validations/availability.ts`

```typescript
import { z } from "zod"

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const
const SLOT_START_TIMES = ["08:00", "10:00", "12:00", "14:00", "16:00"] as const

/** Single slot: a weekday + start time pair */
const slotSchema = z.object({
  day_of_week: z.enum(WEEKDAYS),
  start_time: z.enum(SLOT_START_TIMES),
})

/**
 * Schema for the full weekly availability grid.
 * Input: an array of {day_of_week, start_time} pairs representing active slots.
 * The server action will compute end_time = start_time + 2h.
 */
export const weeklyAvailabilitySchema = z.object({
  driver_id: z.string().uuid("Ungueltige Fahrer-ID"),
  slots: z
    .array(slotSchema)
    .max(25, "Maximal 25 Slots (5 Tage x 5 Zeitfenster)")
    .refine(
      (slots) => {
        const keys = slots.map((s) => `${s.day_of_week}-${s.start_time}`)
        return new Set(keys).size === keys.length
      },
      { message: "Doppelte Slots sind nicht erlaubt" }
    ),
})

export type WeeklyAvailabilityValues = z.infer<typeof weeklyAvailabilitySchema>
export type SlotValue = z.infer<typeof slotSchema>

/** Constants for UI rendering */
export const WEEKDAY_LABELS: Record<(typeof WEEKDAYS)[number], string> = {
  monday: "Montag",
  tuesday: "Dienstag",
  wednesday: "Mittwoch",
  thursday: "Donnerstag",
  friday: "Freitag",
}

export const SLOT_LABELS: Record<(typeof SLOT_START_TIMES)[number], string> = {
  "08:00": "08:00 - 10:00",
  "10:00": "10:00 - 12:00",
  "12:00": "12:00 - 14:00",
  "14:00": "14:00 - 16:00",
  "16:00": "16:00 - 18:00",
}

export { WEEKDAYS, SLOT_START_TIMES }
```

#### 5c: Server Actions fuer Fahrerprofil anpassen

**Aendern:** `src/actions/drivers.ts`

Keine strukturelle Aenderung noetig. Die bestehenden `createDriver` und `updateDriver` Actions verwenden `driverSchema` und leiten `result.data` direkt an Supabase weiter. Da der Zod-Schema erweitert wird und die neuen Felder die gleichen Namen wie die DB-Spalten tragen, funktioniert das automatisch.

**Einzige Aenderung:** `requireAuth` importieren und verwenden (Konsistenz mit rides.ts):

```typescript
"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/require-auth"
import { driverSchema } from "@/lib/validations/drivers"
import type { ActionResult } from "@/actions/shared"
import type { Tables } from "@/lib/types/database"

export async function createDriver(
  _prevState: ActionResult<Tables<"drivers">> | null,
  formData: FormData
): Promise<ActionResult<Tables<"drivers">>> {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const raw = Object.fromEntries(formData)
  const result = driverSchema.safeParse(raw)

  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("drivers")
    .insert(result.data)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/drivers")
  redirect("/drivers")
}

export async function updateDriver(
  id: string,
  _prevState: ActionResult<Tables<"drivers">> | null,
  formData: FormData
): Promise<ActionResult<Tables<"drivers">>> {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const raw = Object.fromEntries(formData)
  const result = driverSchema.safeParse(raw)

  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("drivers")
    .update(result.data)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/drivers")
  redirect("/drivers")
}

export async function toggleDriverActive(
  id: string,
  isActive: boolean
): Promise<ActionResult> {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("drivers")
    .update({ is_active: isActive })
    .eq("id", id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/drivers")
  return { success: true, data: undefined }
}
```

#### 5d: Server Action fuer Verfuegbarkeit

**Neue Datei:** `src/actions/availability.ts`

```typescript
"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/require-auth"
import { weeklyAvailabilitySchema, SLOT_START_TIMES } from "@/lib/validations/availability"
import type { ActionResult } from "@/actions/shared"

/** Compute end_time from start_time (add 2 hours) */
function slotEndTime(startTime: string): string {
  const hour = parseInt(startTime.split(":")[0]!, 10)
  return `${String(hour + 2).padStart(2, "0")}:00`
}

/**
 * Replace-all strategy: delete all weekly slots for a driver,
 * then insert the new set.
 *
 * Callable by:
 * - Staff (admin/operator) for any driver
 * - Driver for their own availability
 */
export async function saveWeeklyAvailability(
  input: { driver_id: string; slots: { day_of_week: string; start_time: string }[] }
): Promise<ActionResult> {
  const auth = await requireAuth()
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const result = weeklyAvailabilitySchema.safeParse(input)
  if (!result.success) {
    const errors = result.error.flatten()
    return {
      success: false,
      error: errors.formErrors[0] ?? "Validierungsfehler",
      fieldErrors: errors.fieldErrors as Record<string, string[]>,
    }
  }

  const { driver_id, slots } = result.data

  // Authorization check: drivers can only manage their own availability
  if (auth.role === "driver" && auth.driverId !== driver_id) {
    return { success: false, error: "Keine Berechtigung fuer diesen Fahrer" }
  }

  const supabase = await createClient()

  // Step 1: Delete all existing weekly slots for this driver
  const { error: deleteError } = await supabase
    .from("driver_availability")
    .delete()
    .eq("driver_id", driver_id)
    .not("day_of_week", "is", null)  // only weekly slots, preserve specific_date entries

  if (deleteError) {
    return { success: false, error: deleteError.message }
  }

  // Step 2: Insert new slots
  if (slots.length > 0) {
    const rows = slots.map((slot) => ({
      driver_id,
      day_of_week: slot.day_of_week,
      start_time: slot.start_time,
      end_time: slotEndTime(slot.start_time),
    }))

    const { error: insertError } = await supabase
      .from("driver_availability")
      .insert(rows)

    if (insertError) {
      return { success: false, error: insertError.message }
    }
  }

  revalidatePath(`/drivers/${driver_id}/availability`)
  revalidatePath(`/drivers/${driver_id}`)
  return { success: true, data: undefined }
}
```

**Verifikation Schritt 5:**
- Zod-Schema: `driverSchema.safeParse({...})` mit allen neuen Feldern funktioniert
- Zod-Schema: PLZ-Validierung `'123'` wird abgewiesen, `'8001'` akzeptiert
- Availability-Schema: Doppelte Slots werden erkannt
- Availability-Schema: Nur erlaubte Startzeiten werden akzeptiert
- Server Action: Replace-All-Strategie loescht nur weekly Slots (nicht specific_date)

---

### Schritt 6: UI -- Fahrerformular und Fahrertabelle erweitern (#16)

#### 6a: Fahrerformular erweitern

**Aendern:** `src/components/drivers/driver-form.tsx`

Struktur des erweiterten Formulars:

```
Card "Fahrer bearbeiten"
  |-- Vorname / Nachname (bestehend, 2-spaltig)
  |-- Telefon / Fahrzeugtyp (bestehend, 2-spaltig)
  |-- <AddressFields required /> (wiederverwendbar, wie bei Patienten)
  |-- Fahrzeug / Fahrausweis (2-spaltig, optional)
  |-- Notfallkontakt Name / Telefon (2-spaltig, optional)
  |-- Notizen (bestehend, Textarea)
  |-- Speichern / Abbrechen (bestehend)
```

Die wiederverwendbare `<AddressFields>`-Komponente (`src/components/shared/address-fields.tsx`) wird 1:1 eingebunden, genau wie bei Patienten und Zielen. Keine Aenderung an `address-fields.tsx` noetig.

**Vollstaendige Formular-Implementierung:**

```tsx
"use client"

import { useFormState } from "react-dom"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SubmitButton } from "@/components/shared/submit-button"
import { AddressFields } from "@/components/shared/address-fields"
import { createDriver, updateDriver } from "@/actions/drivers"
import type { Tables } from "@/lib/types/database"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface DriverFormProps {
  driver?: Tables<"drivers">
}

export function DriverForm({ driver }: DriverFormProps) {
  const action = driver
    ? updateDriver.bind(null, driver.id)
    : createDriver

  const [state, formAction] = useFormState(action, null)

  const fieldErrors = state && !state.success ? state.fieldErrors : undefined

  return (
    <form action={formAction}>
      <Card>
        <CardHeader>
          <CardTitle>
            {driver ? "Fahrer bearbeiten" : "Neuer Fahrer"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {state && !state.success && state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          {/* --- Name --- */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="first_name">Vorname <span className="text-destructive">*</span></Label>
              <Input
                id="first_name"
                name="first_name"
                required
                defaultValue={driver?.first_name ?? ""}
              />
              {fieldErrors?.first_name && (
                <p className="text-sm text-destructive">{fieldErrors.first_name[0]}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Nachname <span className="text-destructive">*</span></Label>
              <Input
                id="last_name"
                name="last_name"
                required
                defaultValue={driver?.last_name ?? ""}
              />
              {fieldErrors?.last_name && (
                <p className="text-sm text-destructive">{fieldErrors.last_name[0]}</p>
              )}
            </div>
          </div>

          {/* --- Telefon / Fahrzeugtyp --- */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={driver?.phone ?? ""}
              />
              {fieldErrors?.phone && (
                <p className="text-sm text-destructive">{fieldErrors.phone[0]}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicle_type">Fahrzeugtyp <span className="text-destructive">*</span></Label>
              <Select
                name="vehicle_type"
                defaultValue={driver?.vehicle_type ?? "standard"}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="wheelchair">Rollstuhl</SelectItem>
                  <SelectItem value="stretcher">Trage</SelectItem>
                </SelectContent>
              </Select>
              {fieldErrors?.vehicle_type && (
                <p className="text-sm text-destructive">{fieldErrors.vehicle_type[0]}</p>
              )}
            </div>
          </div>

          {/* --- Adresse (wiederverwendbare Komponente) --- */}
          <AddressFields
            defaultValues={{
              street: driver?.street,
              house_number: driver?.house_number,
              postal_code: driver?.postal_code,
              city: driver?.city,
            }}
            errors={fieldErrors}
            required
          />

          {/* --- Fahrzeug / Fahrausweis --- */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="vehicle">Fahrzeug</Label>
              <Input
                id="vehicle"
                name="vehicle"
                placeholder="z.B. VW Caddy Maxi, ZH 123456"
                defaultValue={driver?.vehicle ?? ""}
              />
              {fieldErrors?.vehicle && (
                <p className="text-sm text-destructive">{fieldErrors.vehicle[0]}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="driving_license">Fahrausweis</Label>
              <Input
                id="driving_license"
                name="driving_license"
                placeholder="z.B. Kat. B, Nr. 1234567"
                defaultValue={driver?.driving_license ?? ""}
              />
              {fieldErrors?.driving_license && (
                <p className="text-sm text-destructive">{fieldErrors.driving_license[0]}</p>
              )}
            </div>
          </div>

          {/* --- Notfallkontakt --- */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-medium">Notfallkontakt</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="emergency_contact_name">Name</Label>
                <Input
                  id="emergency_contact_name"
                  name="emergency_contact_name"
                  defaultValue={driver?.emergency_contact_name ?? ""}
                />
                {fieldErrors?.emergency_contact_name && (
                  <p className="text-sm text-destructive">
                    {fieldErrors.emergency_contact_name[0]}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergency_contact_phone">Telefon</Label>
                <Input
                  id="emergency_contact_phone"
                  name="emergency_contact_phone"
                  type="tel"
                  defaultValue={driver?.emergency_contact_phone ?? ""}
                />
                {fieldErrors?.emergency_contact_phone && (
                  <p className="text-sm text-destructive">
                    {fieldErrors.emergency_contact_phone[0]}
                  </p>
                )}
              </div>
            </div>
          </fieldset>

          {/* --- Notizen --- */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notizen</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={driver?.notes ?? ""}
            />
            {fieldErrors?.notes && (
              <p className="text-sm text-destructive">{fieldErrors.notes[0]}</p>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <SubmitButton>Speichern</SubmitButton>
            <Button variant="outline" asChild>
              <Link href="/drivers">Abbrechen</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
```

#### 6b: Fahrertabelle erweitern

**Aendern:** `src/components/drivers/drivers-table.tsx`

Aenderungen:
1. Neue Spalte "Ort" (zeigt `city ?? '-'`)
2. Neue Spalte "Fahrzeug" (zeigt `vehicle ?? '-'`)
3. Suchfilter um `city` und `vehicle` erweitern
4. Aktion "Verfuegbarkeit" als Link zu `/drivers/${id}/availability`

```tsx
// Neue Spalten in TableHeader:
<TableHead>Name</TableHead>
<TableHead>Telefon</TableHead>
<TableHead>Ort</TableHead>
<TableHead>Fahrzeugtyp</TableHead>
<TableHead>Fahrzeug</TableHead>
<TableHead>Status</TableHead>
<TableHead className="w-[80px]" />

// Neue Spalten in TableBody:
<TableCell>{driver.city ?? "–"}</TableCell>
<TableCell>{vehicleTypeLabels[driver.vehicle_type] ?? driver.vehicle_type}</TableCell>
<TableCell>{driver.vehicle ?? "–"}</TableCell>

// Neuer Menue-Eintrag:
<DropdownMenuItem asChild>
  <Link href={`/drivers/${driver.id}/availability`}>
    Verfuegbarkeit
  </Link>
</DropdownMenuItem>

// Suchfilter erweitert:
const filtered = drivers.filter((d) => {
  if (!showInactive && !d.is_active) return false
  const term = search.toLowerCase()
  if (!term) return true
  return (
    d.first_name.toLowerCase().includes(term) ||
    d.last_name.toLowerCase().includes(term) ||
    (d.phone ?? "").toLowerCase().includes(term) ||
    (d.city ?? "").toLowerCase().includes(term) ||
    (d.vehicle ?? "").toLowerCase().includes(term)
  )
})
```

**Verifikation Schritt 6:**
- Neuer Fahrer anlegen mit allen Feldern (Adresse, Fahrzeug, Notfallkontakt) funktioniert
- Bestehenden Fahrer bearbeiten: neue Felder sind vorausgefuellt
- PLZ-Validierung "123" zeigt Fehler im Formular
- Tabelle zeigt Ort und Fahrzeug
- Suche nach "Zuerich" filtert korrekt
- "Verfuegbarkeit"-Link fuehrt zu `/drivers/[id]/availability`

---

### Schritt 7: UI -- Verfuegbarkeitsplaner (Wochenraster) (#17)

#### 7a: Neue Page-Route

**Neue Datei:** `src/app/(dashboard)/drivers/[id]/availability/page.tsx`

```tsx
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/dashboard/page-header"
import { AvailabilityGrid } from "@/components/drivers/availability-grid"

export const metadata: Metadata = {
  title: "Verfuegbarkeit - Dispo",
}

interface AvailabilityPageProps {
  params: Promise<{ id: string }>
}

export default async function AvailabilityPage({ params }: AvailabilityPageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch driver (for display name + 404 check)
  const { data: driver } = await supabase
    .from("drivers")
    .select("id, first_name, last_name")
    .eq("id", id)
    .single()

  if (!driver) {
    notFound()
  }

  // Fetch existing weekly availability slots
  const { data: slots } = await supabase
    .from("driver_availability")
    .select("day_of_week, start_time")
    .eq("driver_id", id)
    .not("day_of_week", "is", null)

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Verfuegbarkeit: ${driver.first_name} ${driver.last_name}`}
        description="Woechentliches Verfuegbarkeitsraster (Mo-Fr, 08:00-18:00)"
        backHref={`/drivers/${id}/edit`}
        backLabel="Zurueck zum Fahrer"
      />
      <AvailabilityGrid
        driverId={id}
        initialSlots={
          (slots ?? [])
            .filter((s): s is { day_of_week: string; start_time: string } => s.day_of_week !== null)
            .map((s) => ({
              day_of_week: s.day_of_week,
              start_time: s.start_time.slice(0, 5),  // "08:00:00" -> "08:00"
            }))
        }
      />
    </div>
  )
}
```

**Hinweis:** `PageHeader` muss eventuell um `backHref`/`backLabel`-Props erweitert werden. Falls diese noch nicht existieren, wird eine optionale "Zurueck"-Button-Prop hinzugefuegt (kleiner Aufwand, analog `createHref`/`createLabel`).

#### 7b: Verfuegbarkeitsraster-Komponente

**Neue Datei:** `src/components/drivers/availability-grid.tsx`

```tsx
"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { saveWeeklyAvailability } from "@/actions/availability"
import {
  WEEKDAYS,
  SLOT_START_TIMES,
  WEEKDAY_LABELS,
  SLOT_LABELS,
} from "@/lib/validations/availability"
import type { SlotValue } from "@/lib/validations/availability"

interface AvailabilityGridProps {
  driverId: string
  initialSlots: SlotValue[]
}

function slotKey(day: string, time: string): string {
  return `${day}-${time}`
}

export function AvailabilityGrid({ driverId, initialSlots }: AvailabilityGridProps) {
  const [activeSlots, setActiveSlots] = useState<Set<string>>(
    () => new Set(initialSlots.map((s) => slotKey(s.day_of_week, s.start_time)))
  )
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function toggleSlot(day: string, time: string) {
    const key = slotKey(day, time)
    setActiveSlots((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
    setSaved(false)
  }

  function handleSave() {
    const slots = Array.from(activeSlots).map((key) => {
      const [day_of_week, start_time] = key.split("-") as [string, string]
      return { day_of_week, start_time }
    })

    startTransition(async () => {
      setError(null)
      const result = await saveWeeklyAvailability({ driver_id: driverId, slots })
      if (!result.success) {
        setError(result.error ?? "Fehler beim Speichern")
      } else {
        setSaved(true)
      }
    })
  }

  function selectAll() {
    const all = new Set<string>()
    for (const day of WEEKDAYS) {
      for (const time of SLOT_START_TIMES) {
        all.add(slotKey(day, time))
      }
    }
    setActiveSlots(all)
    setSaved(false)
  }

  function clearAll() {
    setActiveSlots(new Set())
    setSaved(false)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Wochenraster</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={selectAll} disabled={isPending}>
              Alle auswaehlen
            </Button>
            <Button variant="outline" size="sm" onClick={clearAll} disabled={isPending}>
              Alle entfernen
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <p className="mb-4 text-sm text-destructive">{error}</p>
        )}
        {saved && (
          <p className="mb-4 text-sm text-green-600">Verfuegbarkeit gespeichert.</p>
        )}

        {/* Grid: rows = time slots, columns = weekdays */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="p-2 text-left text-sm font-medium" />
                {WEEKDAYS.map((day) => (
                  <th key={day} className="p-2 text-center text-sm font-medium">
                    {WEEKDAY_LABELS[day]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SLOT_START_TIMES.map((time) => (
                <tr key={time}>
                  <td className="p-2 text-sm font-medium whitespace-nowrap">
                    {SLOT_LABELS[time]}
                  </td>
                  {WEEKDAYS.map((day) => {
                    const key = slotKey(day, time)
                    const isActive = activeSlots.has(key)
                    return (
                      <td key={key} className="p-1 text-center">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => toggleSlot(day, time)}
                          className={`h-10 w-full rounded-md border transition-colors ${
                            isActive
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted/30 border-border hover:bg-muted"
                          } ${isPending ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                          aria-label={`${WEEKDAY_LABELS[day]} ${SLOT_LABELS[time]}: ${isActive ? "aktiv" : "inaktiv"}`}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex gap-3">
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Speichert..." : "Speichern"}
          </Button>
          <span className="self-center text-sm text-muted-foreground">
            {activeSlots.size} von 25 Slots aktiv
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
```

#### 7c: Loading-State

**Neue Datei:** `src/app/(dashboard)/drivers/[id]/availability/loading.tsx`

```tsx
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function AvailabilityLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-6 gap-2">
            {Array.from({ length: 30 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

#### 7d: PageHeader erweitern (falls noetig)

Falls `PageHeader` noch keine `backHref`/`backLabel`-Props hat, wird es erweitert:

**Aendern:** `src/components/dashboard/page-header.tsx`

```tsx
// Neue optionale Props hinzufuegen:
interface PageHeaderProps {
  title: string
  description?: string
  createHref?: string
  createLabel?: string
  backHref?: string    // NEU
  backLabel?: string   // NEU
}

// Im JSX, vor dem Create-Button:
{backHref && (
  <Button variant="outline" size="sm" asChild>
    <Link href={backHref}>{backLabel ?? "Zurueck"}</Link>
  </Button>
)}
```

**Verifikation Schritt 7:**
- `/drivers/[id]/availability` zeigt 5x5 Raster
- Klick auf Zelle toggled den Slot (visuell sofort)
- "Speichern" ruft Server Action auf, zeigt Erfolgs-Meldung
- "Alle auswaehlen" / "Alle entfernen" funktioniert
- Laden der Seite zeigt bestehende Slots als aktiv
- Loading-State zeigt Skeleton
- Zurueck-Link fuehrt zu `/drivers/[id]/edit`

---

### Schritt 8: Tests und Verifikation (#18)

#### 8a: Zod-Schema-Tests erweitern

**Aendern:** `src/lib/validations/__tests__/drivers.test.ts`

Neue Testfaelle:

```typescript
import { describe, it, expect } from "vitest"
import { driverSchema } from "../drivers"

const validDriver = {
  first_name: "Hans",
  last_name: "Meier",
  phone: "+41 79 111 22 33",
  vehicle_type: "standard" as const,
  street: "Bahnhofstrasse",
  house_number: "10",
  postal_code: "8001",
  city: "Zuerich",
  vehicle: "",
  driving_license: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  notes: "",
}

describe("driverSchema", () => {
  it("accepts valid input with all fields", () => {
    const result = driverSchema.safeParse(validDriver)
    expect(result.success).toBe(true)
  })

  // --- Required address fields ---

  it("rejects empty street", () => {
    const result = driverSchema.safeParse({ ...validDriver, street: "" })
    expect(result.success).toBe(false)
  })

  it("rejects empty house_number", () => {
    const result = driverSchema.safeParse({ ...validDriver, house_number: "" })
    expect(result.success).toBe(false)
  })

  it("rejects empty postal_code", () => {
    const result = driverSchema.safeParse({ ...validDriver, postal_code: "" })
    expect(result.success).toBe(false)
  })

  it("rejects empty city", () => {
    const result = driverSchema.safeParse({ ...validDriver, city: "" })
    expect(result.success).toBe(false)
  })

  // --- CH postal code ---

  it("rejects 3-digit postal code", () => {
    const result = driverSchema.safeParse({ ...validDriver, postal_code: "800" })
    expect(result.success).toBe(false)
  })

  it("rejects 5-digit postal code", () => {
    const result = driverSchema.safeParse({ ...validDriver, postal_code: "80010" })
    expect(result.success).toBe(false)
  })

  it("rejects non-numeric postal code", () => {
    const result = driverSchema.safeParse({ ...validDriver, postal_code: "ABCD" })
    expect(result.success).toBe(false)
  })

  it("accepts valid 4-digit postal code", () => {
    const result = driverSchema.safeParse({ ...validDriver, postal_code: "3000" })
    expect(result.success).toBe(true)
  })

  // --- Empty-to-null transforms for new fields ---

  it("transforms empty vehicle to null", () => {
    const result = driverSchema.safeParse(validDriver)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.vehicle).toBeNull()
    }
  })

  it("transforms empty driving_license to null", () => {
    const result = driverSchema.safeParse(validDriver)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.driving_license).toBeNull()
    }
  })

  it("transforms empty emergency_contact_name to null", () => {
    const result = driverSchema.safeParse(validDriver)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.emergency_contact_name).toBeNull()
    }
  })

  // --- Max lengths for new fields ---

  it("rejects vehicle over 200 chars", () => {
    const result = driverSchema.safeParse({ ...validDriver, vehicle: "A".repeat(201) })
    expect(result.success).toBe(false)
  })

  it("rejects driving_license over 100 chars", () => {
    const result = driverSchema.safeParse({ ...validDriver, driving_license: "A".repeat(101) })
    expect(result.success).toBe(false)
  })

  // --- Existing tests (updated with new required fields) ---

  it("rejects empty first_name", () => {
    const result = driverSchema.safeParse({ ...validDriver, first_name: "" })
    expect(result.success).toBe(false)
  })

  it("rejects empty last_name", () => {
    const result = driverSchema.safeParse({ ...validDriver, last_name: "" })
    expect(result.success).toBe(false)
  })

  it("accepts all valid vehicle types", () => {
    for (const type of ["standard", "wheelchair", "stretcher"] as const) {
      const result = driverSchema.safeParse({ ...validDriver, vehicle_type: type })
      expect(result.success).toBe(true)
    }
  })

  it("rejects invalid vehicle type", () => {
    const result = driverSchema.safeParse({ ...validDriver, vehicle_type: "bus" })
    expect(result.success).toBe(false)
  })

  it("defaults vehicle_type to standard when omitted", () => {
    const { vehicle_type: _, ...withoutType } = validDriver
    const result = driverSchema.safeParse(withoutType)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.vehicle_type).toBe("standard")
    }
  })
})
```

#### 8b: Verfuegbarkeits-Schema-Tests

**Neue Datei:** `src/lib/validations/__tests__/availability.test.ts`

```typescript
import { describe, it, expect } from "vitest"
import { weeklyAvailabilitySchema } from "../availability"

const VALID_UUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

describe("weeklyAvailabilitySchema", () => {
  it("accepts empty slots array", () => {
    const result = weeklyAvailabilitySchema.safeParse({
      driver_id: VALID_UUID,
      slots: [],
    })
    expect(result.success).toBe(true)
  })

  it("accepts valid slot", () => {
    const result = weeklyAvailabilitySchema.safeParse({
      driver_id: VALID_UUID,
      slots: [{ day_of_week: "monday", start_time: "08:00" }],
    })
    expect(result.success).toBe(true)
  })

  it("accepts full grid (25 slots)", () => {
    const days = ["monday", "tuesday", "wednesday", "thursday", "friday"]
    const times = ["08:00", "10:00", "12:00", "14:00", "16:00"]
    const slots = days.flatMap((day) =>
      times.map((time) => ({ day_of_week: day, start_time: time }))
    )
    const result = weeklyAvailabilitySchema.safeParse({
      driver_id: VALID_UUID,
      slots,
    })
    expect(result.success).toBe(true)
  })

  it("rejects invalid start_time", () => {
    const result = weeklyAvailabilitySchema.safeParse({
      driver_id: VALID_UUID,
      slots: [{ day_of_week: "monday", start_time: "09:00" }],
    })
    expect(result.success).toBe(false)
  })

  it("rejects weekend day", () => {
    const result = weeklyAvailabilitySchema.safeParse({
      driver_id: VALID_UUID,
      slots: [{ day_of_week: "saturday", start_time: "08:00" }],
    })
    expect(result.success).toBe(false)
  })

  it("rejects duplicate slots", () => {
    const result = weeklyAvailabilitySchema.safeParse({
      driver_id: VALID_UUID,
      slots: [
        { day_of_week: "monday", start_time: "08:00" },
        { day_of_week: "monday", start_time: "08:00" },
      ],
    })
    expect(result.success).toBe(false)
  })

  it("rejects invalid UUID", () => {
    const result = weeklyAvailabilitySchema.safeParse({
      driver_id: "not-a-uuid",
      slots: [],
    })
    expect(result.success).toBe(false)
  })

  it("rejects more than 25 slots", () => {
    const slots = Array.from({ length: 26 }, (_, i) => ({
      day_of_week: "monday",
      start_time: "08:00",
    }))
    const result = weeklyAvailabilitySchema.safeParse({
      driver_id: VALID_UUID,
      slots,
    })
    expect(result.success).toBe(false)
  })
})
```

#### 8c: Manuelle Integrationstests

Checkliste fuer manuelle Verifikation:

1. **Fahrerprofil erstellen** -- Alle neuen Felder ausfuellen, speichern, pruefen ob DB korrekt
2. **Fahrerprofil bearbeiten** -- Bestehender Fahrer, neue Felder hinzufuegen
3. **PLZ-Validierung** -- "123" -> Fehler, "8001" -> OK
4. **Fahrertabelle** -- Ort und Fahrzeug werden angezeigt, Suche funktioniert
5. **Verfuegbarkeit oeffnen** -- `/drivers/[id]/availability` zeigt leeres Raster
6. **Slots togglen** -- Klick auf Zelle, visuelle Rueckmeldung
7. **Speichern** -- Erfolgs-Meldung, Seite neu laden zeigt gespeicherte Slots
8. **Replace-All** -- Slots aendern + speichern, alte Slots weg, neue da
9. **"Alle auswaehlen"** -- Alle 25 Zellen aktiv
10. **"Alle entfernen"** -- Alle Zellen inaktiv
11. **Rides-Integration** -- Ride-Form zeigt Fahrer weiterhin korrekt (kein Breaking Change)

---

## Dateiliste

### Neue Dateien

| Datei | Schritt | Zweck |
|-------|---------|-------|
| `docs/adrs/005-driver-profile-availability.md` | 1 | Dieses ADR |
| `supabase/migrations/20260223_000001_driver_profile_ch.sql` | 2 | Fahrerfelder erweitern |
| `supabase/migrations/20260223_000002_availability_fixed_slots.sql` | 3 | 2h-Slot-Modell |
| `supabase/migrations/20260223_000003_availability_rls_driver.sql` | 4 | RLS fuer Fahrer |
| `src/lib/validations/availability.ts` | 5b | Zod-Schema Verfuegbarkeit |
| `src/actions/availability.ts` | 5d | Server Action Verfuegbarkeit |
| `src/app/(dashboard)/drivers/[id]/availability/page.tsx` | 7a | Availability Page |
| `src/app/(dashboard)/drivers/[id]/availability/loading.tsx` | 7c | Loading Skeleton |
| `src/lib/validations/__tests__/availability.test.ts` | 8b | Tests Verfuegbarkeit |

### Geaenderte Dateien

| Datei | Schritt | Aenderung |
|-------|---------|-----------|
| `src/lib/types/database.ts` | 2, 3 | drivers + driver_availability Types aktualisieren |
| `src/lib/validations/drivers.ts` | 5a | Neue Felder im Zod-Schema |
| `src/actions/drivers.ts` | 5c | requireAuth einbauen |
| `src/components/drivers/driver-form.tsx` | 6a | Formular erweitern |
| `src/components/drivers/drivers-table.tsx` | 6b | Tabelle erweitern |
| `src/components/dashboard/page-header.tsx` | 7d | backHref/backLabel Props |
| `src/lib/validations/__tests__/drivers.test.ts` | 8a | Tests erweitern |

### Unveraenderte Dateien (Kompatibilitaet bestaetigt)

| Datei | Grund |
|-------|-------|
| `src/actions/rides.ts` | Ride-Form nutzt nur `id, first_name, last_name` von drivers -- kein Breaking Change |
| `src/components/rides/ride-form.tsx` | Fahrer-Select braucht nur Name, nicht die neuen Felder |
| `src/lib/validations/rides.ts` | driver_id bleibt nullable UUID -- unveraendert |

---

## Risiken und Technical Debt

1. **Fahrer-Selbstverwaltungs-UI fehlt** -- M4 liefert nur die Staff-Perspektive fuer Verfuegbarkeit. Fahrer brauchen spaeter eine eigene Route (z.B. `/my/availability`). Die Server Actions und RLS sind aber bereits vorbereitet.

2. **Keine Validierung: Adresse bei Altdaten** -- Bestehende Fahrer ohne Adresse koennen nicht gespeichert werden, bis die Adresse nachgetragen ist. Das ist gewollt (analog M5 Patienten), sollte aber im Onboarding kommuniziert werden.

3. **specific_date-Slots UI nicht implementiert** -- Das DB-Modell unterstuetzt datumsspezifische Slots, aber M4 baut nur das Wochenraster-UI. Spaeterer Milestone.

4. **Kein UPDATE-RLS fuer Fahrer auf availability** -- Bewusste Entscheidung (Replace-All statt Update). Falls spaeter Einzel-Slot-Updates noetig werden, muss eine UPDATE-Policy nachgezogen werden.

5. **PageHeader-Erweiterung** -- Die `backHref`/`backLabel`-Props koennten auch als separate `BackButton`-Komponente implementiert werden. Fuer M4 reicht die Props-Erweiterung.

---

## Consequences

- **Positiv:** Vollstaendiges Fahrerprofil mit CH-Adressvalidierung
- **Positiv:** Deterministisches Slot-Modell eliminiert Fehlerquellen bei freien Zeiteingaben
- **Positiv:** Fahrer koennen ihre eigene Verfuegbarkeit pflegen (RLS + Server Actions bereit)
- **Positiv:** Replace-All ist einfacher als Diff-basierte Updates
- **Negativ:** Bestehende Fahrer muessen Adresse nachtragen beim naechsten Edit
- **Negativ:** Fahrer-Selbstverwaltungs-UI muss in separatem Milestone folgen
