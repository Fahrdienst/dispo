# ADR 008: Fahrtenplanung erweitern -- Terminzeitraum und Heimfahrt-Verkuepfung

## Status

Proposed

## Date

2026-02-20

## Context

Die aktuelle `rides`-Tabelle kennt nur ein einziges Zeitfeld: `pickup_time` (time, NOT NULL). Das reicht fuer einfache Einzel-Transporte, bildet aber den realen Terminablauf nicht ab:

1. **Abholzeitpunkt** -- Wann wird der Patient abgeholt? (= bestehendes `pickup_time`)
2. **Terminbeginn** -- Wann beginnt der Termin beim Ziel?
3. **Terminende** -- Wann endet der Termin?
4. **Heimfahrt** -- Wann soll der Patient zurueck abgeholt werden?

Aktuell muss die Disposition die Heimfahrt komplett manuell als separate Fahrt erfassen und alle Felder (Patient, Ziel, Datum) erneut eingeben. Das ist fehleranfaellig und zeitaufwaendig.

Zusaetzlich gibt es keine Verbindung zwischen Hin- und Heimfahrt. Der Disponent sieht zwei unabhaengige Fahrten und kann nicht erkennen, dass sie zusammengehoeren.

### Bestehende rides-Struktur (Stand ADR-002)

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

### Offene Fragen aus Issue #45

1. Verkuepfung technisch via `ride_group_id` vs. `parent_ride_id`?
2. Default-Puffer zwischen Terminende und Heimfahrt?
3. Verhalten bei Terminverlaengerung (automatische Verschiebung ja/nein)?

---

## Fachentscheid 1: Verkuepfungsmodell -- `parent_ride_id` (Self-Reference)

### Optionen

| Kriterium | Option A: `parent_ride_id` (Self-FK) | Option B: `ride_group_id` (Gruppierungs-UUID) |
|-----------|--------------------------------------|----------------------------------------------|
| Beziehung | 1 Hinfahrt -> N Rueckfahrten (Parent-Child) | N Fahrten in 1 Gruppe (peer-to-peer) |
| Richtung | Klar: Parent = Hinfahrt, Child = Rueckfahrt | Unklar: welche Fahrt ist "fuehrend"? |
| Abfrage "Finde Heimfahrt" | `WHERE parent_ride_id = :hinfahrt_id` | `WHERE ride_group_id = :group AND id != :self` |
| Abfrage "Finde Hinfahrt" | `SELECT * FROM rides WHERE id = :parent_ride_id` | `WHERE ride_group_id = :group AND direction = 'outbound'` |
| Zukunft: Mehrfachfahrten | Mehrere Children moeglich (z.B. Therapie-Kette) | Gleichberechtigt, aber keine Hierarchie |
| Komplexitaet | 1 Nullable FK-Spalte + Self-Reference | 1 Nullable UUID-Spalte (kein FK) |
| Datenintegritaet | FK-Constraint schuetzt vor Waisen | Kein FK -- Gruppe kann verwaisen |
| Kaskade | ON DELETE SET NULL: Heimfahrt bleibt, verliert Bezug | Manuelle Bereinigung noetig |

### Entscheidung

**Option A: `parent_ride_id`** als nullable Self-FK auf `rides.id`.

### Begruendung

1. **Klare Hierarchie:** Der fachliche Use-Case ist asymmetrisch -- eine Hinfahrt "erzeugt" eine Heimfahrt, nicht umgekehrt. `parent_ride_id` bildet diese Parent-Child-Beziehung direkt ab.
2. **Einfache Abfragen:** `WHERE parent_ride_id = :id` ist ein trivialer Index-Lookup. Bei `ride_group_id` muessten wir immer die Direction mitfiltern.
3. **FK-Integritaet:** Der Self-FK verhindert Referenzen auf nicht-existierende Fahrten. `ride_group_id` waere nur eine UUID ohne referenzielle Integritaet.
4. **Zukunftssicher:** Falls spaeter eine Therapie-Kette (Hin -> Therapie A -> Therapie B -> Rueck) gebraucht wird, kann jede Fahrt ihren `parent_ride_id` haben. Mit `ride_group_id` waere die Reihenfolge nicht abbildbar.
5. **Einfachheit:** Eine Spalte, ein FK, fertig. Kein zusaetzliches Konzept ("Gruppe") das erklaert werden muss.

### Constraints

```sql
ALTER TABLE public.rides
  ADD COLUMN parent_ride_id uuid REFERENCES public.rides(id) ON DELETE SET NULL;
```

- `ON DELETE SET NULL`: Wird die Hinfahrt geloescht/deaktiviert, bleibt die Heimfahrt bestehen, verliert aber die Verkuepfung. Das ist gewollt -- die Heimfahrt war bereits geplant und soll nicht verschwinden.
- Nur Fahrten mit `direction = 'return'` sollten einen `parent_ride_id` haben. Wir erzwingen das nicht per CHECK-Constraint (zu rigide fuer Migrations-/Datenreparatur-Szenarien), sondern in der Application-Layer-Validierung.

---

## Fachentscheid 2: Zeitfelder -- Drei neue nullable Spalten

### Bestandsaufnahme

| Feld | Typ | Bestand | Semantik |
|------|-----|---------|----------|
| `pickup_time` | time | NOT NULL | Abholzeitpunkt (bleibt unveraendert) |
| `appointment_time` | time | **NEU** | Terminbeginn beim Ziel |
| `appointment_end_time` | time | **NEU** | Terminende beim Ziel |
| `return_pickup_time` | time | **NEU** | Abholzeit fuer Heimfahrt (= pickup_time der Rueckfahrt) |

### Optionen

| Kriterium | Option A: Alle 3 nullable | Option B: `appointment_time` required, Rest nullable | Option C: Nur `appointment_time` + `appointment_end_time` |
|-----------|--------------------------|-----------------------------------------------------|---------------------------------------------------------|
| Rueckwaertskompatibilitaet | Bestehende Fahrten bleiben gueltig | Migration muesste Altdaten fuellen | Bestehende Fahrten bleiben gueltig |
| Flexibilitaet | Disponent kann Zeitfelder schrittweise ausfuellen | Erzwingt Terminzeit bei jeder Fahrt | Kein `return_pickup_time` |
| Fachliche Korrektheit | Nicht jede Fahrt hat einen Termin (z.B. Abholung vom Spital) | Nicht immer bekannt | Heimfahrt-Zeitplanung nicht in Hinfahrt abbildbar |

### Entscheidung

**Option A: Alle drei Felder nullable.**

### Begruendung

1. **Rueckwaertskompatibilitaet:** Bestehende Fahrten (und Fahrten aus ride_series) haben keine Terminzeiten. Eine NOT NULL Constraint wuerde eine Datenmigration erfordern, die bei Pre-MVP zwar machbar, aber unnoetig ist -- nicht jede Fahrt hat einen strukturierten Termin.
2. **Fachliche Realitaet:** Manche Transporte sind reine Abholungen (z.B. Entlassung aus Spital) ohne definierten Terminzeitraum. `appointment_time` und `appointment_end_time` waeren dort sinnlos.
3. **`return_pickup_time` auf der Hinfahrt:** Speichert die geplante Abholzeit fuer die Rueckfahrt *bevor* die Rueckfahrt erstellt wird. Beim Erstellen der Rueckfahrt wird dieser Wert als `pickup_time` der Rueckfahrt uebernommen.

### Warum `time` statt `timestamptz`?

Die bestehende `pickup_time` ist `time` (ohne Datum). Das Datum kommt aus `rides.date`. Wir bleiben konsistent und verwenden `time` fuer alle Zeitfelder. Ein Termin, der ueber Mitternacht geht, ist im Fahrdienst-Kontext nicht relevant.

### Validierungsregeln (Zeitreihenfolge)

Wenn die Felder gesetzt sind, gilt folgende Reihenfolge:

```
pickup_time < appointment_time < appointment_end_time
appointment_end_time <= return_pickup_time
```

Diese Validierung findet in der Application-Layer statt (Zod + Server Action), nicht per CHECK-Constraint. Begruendung: Die Felder sind nullable und die Validierung haengt davon ab, welche Felder gesetzt sind. Ein CHECK-Constraint mit `CASE WHEN ... IS NOT NULL THEN ...` waere unuebersichtlich und schwer zu debuggen.

---

## Fachentscheid 3: Auto-Heimfahrt -- Server Action mit Default-Puffer

### Ablauf

1. Disponent erstellt/bearbeitet eine Hinfahrt (`direction = 'outbound'`).
2. Wenn `appointment_end_time` gesetzt ist, zeigt das Formular eine Checkbox: **"Heimfahrt automatisch anlegen"** (Default: nicht angehakt).
3. Wenn angehakt: Die Server Action `createRide` (oder eine neue `createRideWithReturn`) erstellt zwei Fahrten in einer Transaktion:
   - **Hinfahrt:** wie bisher, plus `appointment_time`, `appointment_end_time`, `return_pickup_time`
   - **Heimfahrt:** neue Fahrt mit `direction = 'return'`, `parent_ride_id` = Hinfahrt-ID, `pickup_time` = `return_pickup_time` der Hinfahrt

### Default-Puffer

```
return_pickup_time = appointment_end_time + 15 Minuten
```

**Begruendung fuer 15 Minuten:**
- Realistische Wartezeit nach Therapie/Arztbesuch
- Nicht zu knapp (Patient muss aus Behandlung kommen), nicht zu lang (Fahrer wartet nicht 30+ Minuten)
- Der Disponent kann den Wert jederzeit manuell anpassen

Der Puffer wird als Konstante definiert (`DEFAULT_RETURN_BUFFER_MINUTES = 15`), nicht als Datenbank-Wert, da er sich nur per Code-Release aendern soll.

### Heimfahrt-Defaults

Die automatisch erstellte Heimfahrt uebernimmt von der Hinfahrt:
- `patient_id` (identisch)
- `destination_id` (identisch -- Patient faehrt zum gleichen Ziel zurueck)
- `date` (identisch)
- `driver_id`: **NULL** (= `unplanned`). Die Rueckfahrt wird separat disponiert, da der Hinfahrt-Fahrer nicht zwingend fuer die Rueckfahrt verfuegbar ist.
- `notes`: nicht uebernommen (Hinfahrt-Notizen sind hinfahrt-spezifisch)

**Hinweis zur `destination_id`:** Fachlich faehrt die Hinfahrt *zum* Ziel und die Heimfahrt *vom* Ziel. In unserem Modell speichert `destination_id` den medizinischen Zielort (Praxis, Spital), nicht die Fahrtrichtung. Die Richtung kommt aus `direction`. Das ist bewusst so -- die `destination_id` beantwortet die Frage "Wo ist der Termin?", nicht "Wohin faehrt das Auto?".

---

## Fachentscheid 4: Aenderungs-Semantik -- Keine automatische Kaskade

### Optionen

| Szenario | Option A: Automatische Kaskade | Option B: Manuelle Anpassung mit Hinweis |
|----------|-------------------------------|----------------------------------------|
| Terminende aendert sich | Heimfahrt-pickup_time wird automatisch verschoben | UI zeigt Warnung: "Heimfahrt-Abholzeit stimmt nicht mehr" |
| Hinfahrt wird storniert | Heimfahrt wird automatisch storniert | UI zeigt Warnung: "Verknuepfte Heimfahrt existiert noch" |
| Komplexitaet | Hoch: Trigger/Action-Kaskade, Race Conditions | Niedrig: nur UI-Hinweis |
| Fehlerrisiko | Hoch: ungewollte Stornierungen | Niedrig: Disponent entscheidet |
| Reversibilitaet | Schwer: automatische Aenderungen rueckgaengig machen | Einfach: keine automatischen Aenderungen |

### Entscheidung

**Option B: Manuelle Anpassung mit Hinweis.**

### Begruendung

1. **Prinzip "Simple first":** Automatische Kaskaden sind eine signifikante Quelle von Bugs und unerwarteten Seiteneffekten. Der Fahrdienst-Kontext ist zu komplex fuer pauschale Regeln (z.B. Termin wird verschoben, aber der Rueckfahrt-Fahrer hat schon bestaetigt).
2. **Disposition ist menschliche Arbeit:** Der Disponent muss die Gesamtsituation bewerten (Fahrerverfuegbarkeit, andere Fahrten, Patientenwuensche). Automatische Aenderungen nehmen diese Entscheidung vorweg.
3. **Implementierungsaufwand:** Kaskaden erfordern Transaktionslogik, Conflict Resolution, Benachrichtigungen. Das ist ein Feature fuer einen spaeteren Milestone.

### Was passiert konkret?

- **Hinfahrt bearbeiten:** Wenn `appointment_end_time` sich aendert und eine verknuepfte Heimfahrt existiert (`SELECT id FROM rides WHERE parent_ride_id = :hinfahrt_id`), zeigt das Edit-Formular einen Hinweis: *"Es gibt eine verknuepfte Heimfahrt. Bitte pruefen Sie, ob die Abholzeit noch passt."*
- **Hinfahrt stornieren (cancelled):** Wenn eine verknuepfte Heimfahrt existiert, zeigt die UI einen Hinweis: *"Achtung: Es gibt eine verknuepfte Heimfahrt, die nicht automatisch storniert wird."*
- **Heimfahrt bearbeiten:** Frei editierbar, keine Einschraenkungen durch die Hinfahrt.
- **Heimfahrt stornieren:** Kein Effekt auf die Hinfahrt.

### Spaeters Upgrade-Pfad

Falls automatische Kaskade spaeter gewuenscht wird:
1. `appointment_end_time`-Aenderung auf Hinfahrt -> Optional: `return_pickup_time` auf Hinfahrt automatisch anpassen (einfache Puffer-Logik, gleiche Fahrt)
2. `return_pickup_time`-Aenderung auf Hinfahrt -> Optional: `pickup_time` der Heimfahrt mitziehen (Cross-Ride-Update, braucht Transaktionslogik)
3. Stornierung -> Optional: Confirm-Dialog "Heimfahrt auch stornieren?"

---

## Migration SQL

**Neue Datei:** `supabase/migrations/20260227_000001_ride_planning_extension.sql`

```sql
-- =============================================================
-- ADR-008: Ride Planning Extension
-- Adds appointment time fields and parent-child ride linking.
--
-- Changes:
--   1. Add parent_ride_id (self-FK) for outbound/return linking
--   2. Add appointment_time, appointment_end_time, return_pickup_time
--   3. Index on parent_ride_id for fast child lookup
-- =============================================================

-- -------------------------------------------------------------
-- 1. Parent-Child ride linking
-- -------------------------------------------------------------

ALTER TABLE public.rides
  ADD COLUMN parent_ride_id uuid REFERENCES public.rides(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.rides.parent_ride_id IS
  'Links a return ride to its outbound parent. NULL for outbound rides and standalone rides.';

-- Index for: "find all return rides for this outbound ride"
CREATE INDEX idx_rides_parent ON public.rides (parent_ride_id)
  WHERE parent_ride_id IS NOT NULL;

-- -------------------------------------------------------------
-- 2. Appointment time fields
-- -------------------------------------------------------------

ALTER TABLE public.rides
  ADD COLUMN appointment_time     time,
  ADD COLUMN appointment_end_time time,
  ADD COLUMN return_pickup_time   time;

COMMENT ON COLUMN public.rides.appointment_time IS
  'Scheduled start of the medical appointment at the destination.';
COMMENT ON COLUMN public.rides.appointment_end_time IS
  'Scheduled end of the medical appointment at the destination.';
COMMENT ON COLUMN public.rides.return_pickup_time IS
  'Planned pickup time for the return ride (on the outbound ride record).';

-- -------------------------------------------------------------
-- 3. Partial CHECK: appointment_end > appointment_start
--    Only when both are set. Lightweight DB-level safety net.
-- -------------------------------------------------------------

ALTER TABLE public.rides
  ADD CONSTRAINT rides_appointment_time_order
  CHECK (
    appointment_time IS NULL
    OR appointment_end_time IS NULL
    OR appointment_end_time > appointment_time
  );

-- Partial CHECK: pickup_time < appointment_time (when both set)
ALTER TABLE public.rides
  ADD CONSTRAINT rides_pickup_before_appointment
  CHECK (
    pickup_time IS NULL
    OR appointment_time IS NULL
    OR pickup_time < appointment_time
  );

-- Partial CHECK: return_pickup_time >= appointment_end_time (when both set)
ALTER TABLE public.rides
  ADD CONSTRAINT rides_return_after_appointment_end
  CHECK (
    return_pickup_time IS NULL
    OR appointment_end_time IS NULL
    OR return_pickup_time >= appointment_end_time
  );
```

### Hinweis: Keine RLS-Aenderung noetig

Die neuen Spalten erben die bestehenden RLS-Policies der `rides`-Tabelle (Spalten-basiert, nicht Zeilen-basiert). Staff kann alle Fahrten lesen/schreiben, Fahrer sehen nur ihre zugewiesenen Fahrten. Keine neuen Policies noetig.

### Hinweis: pickup_time ist NOT NULL

`pickup_time` ist in der bestehenden Tabelle `NOT NULL`. Der CHECK-Constraint `rides_pickup_before_appointment` enthaelt `pickup_time IS NULL` als Safety-Net-Klausel, die in der Praxis nie greifen wird (da die Spalte NOT NULL ist). Das ist bewusst defensiv -- falls die Constraint-Reihenfolge bei zukuenftigen Migrationen relevant wird.

---

## Validierungsregeln -- Zod-Schema-Erweiterung

**Aendern:** `src/lib/validations/rides.ts`

```typescript
import { z } from "zod"

const emptyToNull = (v: string) => (v === "" ? null : v)

/**
 * Default buffer (minutes) between appointment_end_time and return_pickup_time.
 * Used in the UI to pre-fill the return pickup time suggestion.
 */
export const DEFAULT_RETURN_BUFFER_MINUTES = 15

/**
 * Adds minutes to a time string (HH:MM format).
 * Returns null if the result exceeds 23:59.
 */
export function addMinutesToTime(time: string, minutes: number): string | null {
  const [h, m] = time.split(":").map(Number)
  if (h === undefined || m === undefined) return null
  const totalMinutes = h * 60 + m + minutes
  if (totalMinutes >= 24 * 60) return null
  const newH = Math.floor(totalMinutes / 60)
  const newM = totalMinutes % 60
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`
}

export const rideSchema = z
  .object({
    patient_id: z.string().uuid("Patient ist erforderlich"),
    destination_id: z.string().uuid("Ziel ist erforderlich"),
    driver_id: z
      .string()
      .transform(emptyToNull)
      .nullable()
      .optional(),
    date: z.string().min(1, "Datum ist erforderlich"),
    pickup_time: z.string().min(1, "Abholzeit ist erforderlich"),
    direction: z.enum(["outbound", "return", "both"]).default("outbound"),
    // --- New appointment time fields (ADR-008) ---
    appointment_time: z
      .string()
      .transform(emptyToNull)
      .nullable()
      .optional(),
    appointment_end_time: z
      .string()
      .transform(emptyToNull)
      .nullable()
      .optional(),
    return_pickup_time: z
      .string()
      .transform(emptyToNull)
      .nullable()
      .optional(),
    // --- Auto-return flag (not persisted, used by Server Action) ---
    create_return_ride: z
      .string()
      .optional()
      .transform((v) => v === "on" || v === "true"),
    notes: z
      .string()
      .max(1000)
      .transform(emptyToNull)
      .nullable()
      .optional(),
  })
  .superRefine((data, ctx) => {
    // Time order validation (only when fields are set)
    if (data.appointment_time && data.pickup_time) {
      if (data.pickup_time >= data.appointment_time) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["appointment_time"],
          message: "Terminzeit muss nach der Abholzeit liegen",
        })
      }
    }

    if (data.appointment_time && data.appointment_end_time) {
      if (data.appointment_end_time <= data.appointment_time) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["appointment_end_time"],
          message: "Terminende muss nach dem Terminbeginn liegen",
        })
      }
    }

    if (data.appointment_end_time && data.return_pickup_time) {
      if (data.return_pickup_time < data.appointment_end_time) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["return_pickup_time"],
          message: "Rueckfahrt-Abholzeit darf nicht vor dem Terminende liegen",
        })
      }
    }

    // If create_return_ride is checked, appointment_end_time is required
    if (data.create_return_ride && !data.appointment_end_time) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["appointment_end_time"],
        message:
          "Terminende ist erforderlich, wenn eine Heimfahrt angelegt werden soll",
      })
    }
  })

export type RideFormValues = z.infer<typeof rideSchema>
```

### Aenderungen gegenueber bestehendem Schema

1. Drei neue optionale time-Felder: `appointment_time`, `appointment_end_time`, `return_pickup_time`
2. Ein transientes Boolean-Feld: `create_return_ride` (wird nicht in DB gespeichert, steuert die Server Action)
3. `.superRefine()` fuer Zeitreihenfolge-Validierung (ersetzt das bisherige `.object()` ohne Refinement)
4. Bestehende Felder bleiben identisch -- volle Rueckwaertskompatibilitaet

---

## Server Action: `createRide` erweitern

**Aendern:** `src/actions/rides.ts`

Die bestehende `createRide` Action wird erweitert, um optional eine Heimfahrt zu erzeugen.

```typescript
// Pseudocode fuer die Erweiterung in createRide:

export async function createRide(
  _prevState: ActionResult<Tables<"rides">> | null,
  formData: FormData
): Promise<ActionResult<Tables<"rides">>> {
  // ... bestehende Auth + Validation ...

  const { create_return_ride, ...rideData } = result.data
  const status = rideData.driver_id ? "planned" : "unplanned"

  const supabase = await createClient()

  // 1. Hinfahrt erstellen
  const { data: outboundRide, error } = await supabase
    .from("rides")
    .insert({ ...rideData, status })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // 2. Optional: Heimfahrt erstellen
  if (create_return_ride && rideData.direction === "outbound") {
    const returnPickupTime =
      rideData.return_pickup_time ??
      (rideData.appointment_end_time
        ? addMinutesToTime(rideData.appointment_end_time, DEFAULT_RETURN_BUFFER_MINUTES)
        : null)

    if (returnPickupTime) {
      const { error: returnError } = await supabase
        .from("rides")
        .insert({
          patient_id: rideData.patient_id,
          destination_id: rideData.destination_id,
          date: rideData.date,
          pickup_time: returnPickupTime,
          direction: "return" as const,
          status: "unplanned" as const,
          parent_ride_id: outboundRide.id,
          // driver_id: null -- separat disponieren
          // notes: nicht uebernommen
        })

      if (returnError) {
        // Hinfahrt wurde erstellt, Heimfahrt schlug fehl.
        // Wir geben die Hinfahrt trotzdem als Erfolg zurueck
        // und loggen den Fehler. Der Disponent kann die
        // Heimfahrt manuell nacherfassen.
        console.error("Failed to create return ride:", returnError.message)
      }
    }
  }

  revalidatePath("/rides")
  redirect(`/rides?date=${rideData.date}`)
}
```

### Warum keine DB-Transaktion?

Supabase JS-Client unterstuetzt keine Client-seitigen Transactions. Zwei separate INSERTs sind akzeptabel, weil:
- Die Hinfahrt ist das primaere Ergebnis. Wenn die Heimfahrt fehlschlaegt, ist das ein Minor-Fehler (der Disponent kann sie manuell nachholen).
- Eine Edge Function mit `pg`-Client waere die Alternative fuer echte Transactions. Das ist Pre-MVP Overengineering.

Falls spaeter echte Transaktionssicherheit benoetigt wird (z.B. bei Batch-Generierung aus ride_series), kann eine PostgreSQL-Function oder Edge Function eingefuehrt werden.

---

## TypeScript-Typen aktualisieren

**Aendern:** `src/lib/types/database.ts`

Im `rides`-Block drei neue Felder in Row, Insert, Update:

```typescript
rides: {
  Row: {
    // ... bestehende Felder ...
    appointment_time: string | null       // NEU
    appointment_end_time: string | null   // NEU
    parent_ride_id: string | null         // NEU
    return_pickup_time: string | null     // NEU
  }
  Insert: {
    // ... bestehende Felder ...
    appointment_time?: string | null       // NEU
    appointment_end_time?: string | null   // NEU
    parent_ride_id?: string | null         // NEU
    return_pickup_time?: string | null     // NEU
  }
  Update: {
    // ... bestehende Felder ...
    appointment_time?: string | null       // NEU
    appointment_end_time?: string | null   // NEU
    parent_ride_id?: string | null         // NEU
    return_pickup_time?: string | null     // NEU
  }
  Relationships: [
    // ... bestehende Relationships ...
    {
      foreignKeyName: "rides_parent_ride_id_fkey"
      columns: ["parent_ride_id"]
      isOneToOne: false
      referencedRelation: "rides"
      referencedColumns: ["id"]
    },
  ]
}
```

---

## Betroffene Dateien

### Neue Dateien

| Datei | Zweck |
|-------|-------|
| `supabase/migrations/20260227_000001_ride_planning_extension.sql` | DB-Migration: parent_ride_id + Zeitfelder |

### Geaenderte Dateien

| Datei | Aenderung |
|-------|-----------|
| `src/lib/types/database.ts` | rides: 4 neue Spalten in Row/Insert/Update, 1 neue Relationship |
| `src/lib/validations/rides.ts` | 3 neue Zeitfelder, `create_return_ride`, superRefine-Validierung, Helper-Funktion `addMinutesToTime`, Konstante `DEFAULT_RETURN_BUFFER_MINUTES` |
| `src/actions/rides.ts` | `createRide`: Heimfahrt-Logik. `updateRide`: `create_return_ride`-Feld aus Payload entfernen vor DB-Update |
| `src/components/rides/ride-form.tsx` | 3 neue Zeitfelder (Input type="time"), Checkbox "Heimfahrt anlegen", bedingte Sichtbarkeit von `return_pickup_time` |
| `src/lib/rides/constants.ts` | Optional: Konstante fuer Puffer-Label |

### Neue Dateien (optional, spaeterer Implementierungsschritt)

| Datei | Zweck |
|-------|-------|
| `src/components/rides/linked-ride-badge.tsx` | Anzeige-Komponente fuer verknuepfte Hin-/Heimfahrt |
| `src/lib/validations/__tests__/rides.test.ts` | Tests fuer Zeitreihenfolge-Validierung |

### Unveraenderte Dateien (Kompatibilitaet bestaetigt)

| Datei | Grund |
|-------|-------|
| `src/lib/rides/status-machine.ts` | Status-Uebergaenge bleiben identisch, keine Aenderung am Lifecycle |
| `src/actions/availability.ts` | Keine Abhaengigkeit zu rides-Schema |
| `src/lib/validations/drivers.ts` | Keine Abhaengigkeit |
| Bestehende RLS-Policies | Spaltenbasiert, neue Spalten erben automatisch |

---

## Mapping zu Implementierungsschritten

| Schritt | Beschreibung | Abhaengigkeit |
|---------|-------------|---------------|
| 1 | ADR erstellen (dieses Dokument) | -- |
| 2 | DB-Migration: `parent_ride_id` + Zeitfelder + Constraints + Index | Schritt 1 |
| 3 | TypeScript-Typen aktualisieren (`database.ts`) | Schritt 2 |
| 4 | Zod-Schema erweitern (`rides.ts`): Felder + superRefine + Helpers | Schritt 3 |
| 5 | Server Action erweitern (`rides.ts`): createRide mit Auto-Heimfahrt, updateRide Cleanup | Schritt 4 |
| 6 | UI: Ride-Form erweitern (Zeitfelder + Checkbox + bedingte Sichtbarkeit) | Schritt 5 |
| 7 | UI: Verknuepfte Fahrten anzeigen (Badge/Link in Fahrten-Liste und Detail) | Schritt 6 |
| 8 | UI: Warnhinweise bei Aenderung/Stornierung verknuepfter Fahrten | Schritt 7 |
| 9 | Tests: Zod-Validierung (Zeitreihenfolge, Auto-Heimfahrt-Pflichtfelder) | Schritt 4 |
| 10 | Tests: Manuelle Integration (Erstellen, Verknuepfung, Stornierung) | Schritt 8 |

---

## Risiken und Technical Debt

1. **Keine echte DB-Transaktion fuer Hin+Rueckfahrt:** Zwei separate INSERTs koennten zu einer Situation fuehren, in der die Hinfahrt existiert aber die Heimfahrt fehlt. Risiko ist gering (Supabase-Uptime), aber vorhanden. Mitigation: Error-Logging + manuelle Nacherfassung. Spaeter: PostgreSQL-Function oder Edge Function mit echtem Transaction.

2. **ride_series-Integration fehlt:** Wenn eine Fahrt aus einer Serie generiert wird (ADR-007), wird aktuell keine Heimfahrt automatisch erzeugt. Die Serie kennt `direction = 'both'`, erzeugt aber zwei *unabhaengige* Fahrten (outbound + return ohne `parent_ride_id`). Integration in einem spaeteren Schritt: Serien-Generator soll `parent_ride_id` setzen.

3. **destination_id-Semantik:** `destination_id` ist aktuell der medizinische Zielort. Fuer die Heimfahrt wuerde man streng genommen eine "Abholadresse" und eine "Zieladresse" brauchen. Wir verwenden `destination_id` konsistent fuer den medizinischen Ort. Die Patienten-Adresse (Abholort Hinfahrt / Zielort Heimfahrt) kommt implizit aus `patients.street` etc. Das ist ausreichend fuer den MVP.

4. **UI-Komplexitaet Ride-Form:** Das Formular bekommt signifikant mehr Felder. Es sollte in logische Sektionen aufgeteilt werden (Grunddaten / Termin / Heimfahrt). Kim (UX) sollte das Layout pruefen.

5. **`return_pickup_time` Redundanz:** Der Wert existiert auf der Hinfahrt *und* als `pickup_time` auf der Heimfahrt. Das ist bewusste Denormalisierung -- der Hinfahrt-Record soll den "Plan" festhalten, die Heimfahrt den "Ist"-Zustand (der abweichen kann). Falls das zu Verwirrung fuehrt, kann `return_pickup_time` auf der Hinfahrt spaeter entfernt werden.

---

## Consequences

- **Positiv:** Terminzeitraum wird strukturiert abgebildet statt nur in Notizen
- **Positiv:** Hin- und Heimfahrt sind logisch verknuepft (Parent-Child mit FK-Integritaet)
- **Positiv:** Disponent spart signifikant Zeit bei der Heimfahrt-Erfassung
- **Positiv:** Volle Rueckwaertskompatibilitaet -- bestehende Fahrten bleiben unveraendert
- **Positiv:** Keine Aenderung an RLS-Policies oder Status-Machine noetig
- **Negativ:** Ride-Form wird komplexer (3 neue Felder + Checkbox)
- **Negativ:** Keine echte DB-Transaktion fuer das Fahrtenpaar
- **Negativ:** ride_series-Integration erfordert spaeteren Folge-Schritt
- **Risiko:** Denormalisierung von `return_pickup_time` kann zu Dateninkonsistenz fuehren
