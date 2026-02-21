# ADR-012: Driver Acceptance Flow -- Process, SLA, Reminders, Escalation

## Status

Proposed

## Date

2026-02-21

## Kontext

Das bestehende M7-System (ADR-009) implementiert einen einfachen Zuweisungsflow: Disponent weist Fahrer zu (unplanned -> planned), eine E-Mail mit Token-Links wird versendet, der Fahrer klickt "Annehmen" oder "Ablehnen". Es gibt keine zeitliche Ueberwachung, keine Erinnerungen, keine Eskalation und keine strukturierte Ablehnungserfassung.

In der Praxis fuehrt dies zu Problemen:
- Fahrer reagieren nicht zeitnah, Disponenten bemerken dies erst bei manueller Kontrolle
- Bei kurzfristigen Fahrten (< 60 Min. bis Abholung) fehlt ein beschleunigter Prozess
- Ablehnungen enthalten keine Gruende, was die Ressourcenplanung erschwert
- Es gibt keine KPIs zur Reaktionszeit oder Zuverlaessigkeit

Die Issues #40-#49 definieren ein umfassendes Eskalationssystem mit automatischen Reminders, Timeout-Handling, Rejection-Tracking und Monitoring.

### Zugehoerige Issues

#40 ADR: Process/SLA/Escalation, #41 Data Model, #42 Reminder Engine, #43 Driver UI, #44 Security Hardening, #45 Dispo Queue UI, #46 Mail Templates, #47 Rejection Reasons, #48 Monitoring/KPIs, #49 QA/Rollout

---

## Architektur-Entscheidungen

### 1. Scheduler-Mechanismus: Vercel Cron + Supabase Polling

**Optionen evaluiert:**

| Option | Vorteile | Nachteile |
|--------|----------|-----------|
| A) Vercel Cron (1x/min) | Einfach, serverless-nativ, kein externer Service | Max 1 Aufruf/Min auf Pro, nicht sekundengenau |
| B) Supabase pg_cron + Edge Function | DB-nah, kein App-Deployment noetig | Supabase Free hat kein pg_cron, Edge Functions schlechter debugbar |
| C) Externer Cron (Upstash QStash, Inngest) | Event-driven, praezise Zeitplanung | Externe Abhaengigkeit, Kosten, Setup-Aufwand |
| D) Polling bei jedem Dispatch-Page-Load | Zero Infrastructure | Nicht deterministisch, abhaengig von Nutzeraktivitaet |

**Entscheidung: Option A (Vercel Cron) als Primaermechanismus, Option D als Supplement.**

Begruendung:
- 1-Minuten-Granularitaet reicht fuer 10/25/40-Minuten-Fenster voellig aus
- Der Cron-Endpoint `/api/cron/acceptance-check` laedt alle "wartenden" Zuweisungen und prueft Zeitfenster
- Kein externer Service noetig, kein neuer Vendor-Lock-in
- Supplementaer: Jeder Dispatch-Page-Load prueft ebenfalls und aktualisiert -- dies sorgt fuer sofortige Sichtbarkeit wenn der Disponent die Seite oeffnet
- Vercel Cron ist im Pro-Plan enthalten (kostenfrei)

**Idempotenz-Garantie:** Der Cron-Handler schreibt nur basierend auf dem aktuellen DB-Zustand (Zeitvergleich). Mehrfache Aufrufe innerhalb derselben Minute aendern nichts. Ein `processed_at`-Feld im Escalation-Log verhindert doppelten E-Mail-Versand.

### 2. Status-Modell: Separate `acceptance_tracking`-Tabelle statt neue ride_status-Werte

**Optionen evaluiert:**

| Option | Vorteile | Nachteile |
|--------|----------|-----------|
| A) Neue ride_status Enum-Werte (driver_notified, driver_reminder_1, etc.) | Ein einziger Status-Ort | Enum-Explosion (6 neue Werte), Status-Machine wird komplex, Backward-Kompatibilitaet schwierig, Notification-Zustand vermischt mit Lifecycle-Zustand |
| B) Separate acceptance_tracking-Tabelle | Saubere Trennung (Ride-Lifecycle vs. Notification-Lifecycle), bestehende Status-Machine unveraendert, flexible Erweiterung | Join noetig fuer vollstaendiges Bild, zwei Quellen |

**Entscheidung: Option B -- Separate `acceptance_tracking`-Tabelle.**

Begruendung:
- Der ride_status bildet den **Fahrt-Lifecycle** ab (unplanned -> planned -> confirmed -> in_progress -> ...). Das ist ein orthogonales Konzept zum **Notification-Lifecycle** (notified -> reminded -> escalated -> timed_out).
- Die bestehende Status-Machine (`status-machine.ts`) bleibt unveraendert. Kein Risiko fuer Regressionen in allen Status-abhaengigen Queries.
- Die `acceptance_tracking`-Tabelle lebt parallel: sie wird erstellt wenn eine Zuweisung erfolgt, und geschlossen wenn der Fahrer reagiert oder ein Timeout eintritt.
- Reporting-Queries (KPIs) arbeiten ausschliesslich auf `acceptance_tracking` -- keine Vermischung mit operativen Ride-Queries.
- Der ride_status bleibt bei `planned` waehrend des gesamten Acceptance-Fensters. Erst bei Fahrer-Reaktion wechselt er zu `confirmed` oder `rejected`.

**Neuer Enum: `acceptance_stage`** mit Werten:
`notified`, `reminder_1`, `reminder_2`, `confirmed`, `rejected`, `timed_out`, `cancelled`

### 3. Token-Hashing: SHA-256 mit salted Hash

**Entscheidung: Tokens werden ab sofort als SHA-256-Hash gespeichert. Klartext-Token wird nur in der E-Mail-URL uebermittelt.**

Aenderungen:
- `createAssignmentToken()` speichert `sha256(token)` statt `token` im Feld `token_hash` (Spalte wird umbenannt)
- `consumeToken()` hasht den Input und sucht nach dem Hash: `WHERE token_hash = sha256(input)`
- Bestehender Index auf `token` wird zu Index auf `token_hash`
- Atomische UPDATE-Operation bleibt identisch (WHERE token_hash = X AND used_at IS NULL AND expires_at > now())

Migration fuer bestehende Tokens: Einmalige Migration hasht alle existierenden Klartext-Tokens. Da Tokens 48h-Expiry haben und das Feature jung ist, ist das Risiko minimal.

### 4. Driver UI: Erweiterte `/my/rides`-Seite mit Acceptance-Sektion

**Optionen evaluiert:**

| Option | Vorteile | Nachteile |
|--------|----------|-----------|
| A) Erweiterung `/my/rides` | Bestehendes Pattern, Fahrer kennen die Seite, kein neuer Auth-Kontext | Muss sorgfaeltig von bestaetigten Fahrten abgegrenzt werden |
| B) Neue Route `/my/assignments` | Klare Trennung | Neuer Einstiegspunkt, Fahrer muessen navigieren, Duplizierung |
| C) Rein Email-basiert (kein App-UI) | Einfachste Umsetzung | Kein Ueberblick, kein Batch-Handling, keine Rejection-Reasons |

**Entscheidung: Option A -- Erweiterung von `/my/rides` mit prominenter "Neue Zuweisungen"-Sektion.**

Begruendung:
- Die Seite existiert bereits und wird von Fahrern genutzt
- "Neue Zuweisungen" werden als separate Sektion **oberhalb** der Tagesliste dargestellt, visuell abgesetzt (Amber/Orange-Akzent)
- Jede Karte zeigt: Abholzeit, Ziel, Patient (minimiert), Richtung, Zeitstempel der Zuweisung, Escalation-Badge ("Neu" / "Erinnerung" / "Ueberfaellig")
- Actions pro Karte: "Annehmen"-Button (Primary), "Ablehnen"-Button (Destructive, oeffnet Rejection-Dialog)
- Die E-Mail-Token-Links bleiben als paralleler Kanal bestehen -- Fahrer koennen ueber beide Wege reagieren

### 5. Reminder-Tracking: `acceptance_tracking`-Tabelle als Single Source of Truth

**Entscheidung: Eine neue Tabelle `acceptance_tracking` verfolgt den kompletten Notification-Lifecycle pro Zuweisung.**

Kein separater `reminder_log` -- die `mail_log`-Tabelle dokumentiert bereits jeden Mail-Versand. Die `acceptance_tracking`-Tabelle trackt den **Prozess-Zustand**, nicht die Kommunikation.

Felder:
- `id`, `ride_id`, `driver_id` (FK)
- `stage` (acceptance_stage Enum: notified -> reminder_1 -> reminder_2 -> confirmed/rejected/timed_out/cancelled)
- `notified_at`, `reminder_1_at`, `reminder_2_at`, `resolved_at` (Zeitstempel pro Stufe)
- `resolved_by` (enum: driver_email, driver_app, dispatcher, timeout, system)
- `rejection_reason_code`, `rejection_reason_text` (siehe Entscheidung 6)
- `is_short_notice` (boolean -- markiert ob Fahrt < 60 Min. vor Abholung zugewiesen wurde)
- `created_at`

**SLA-Fenster (konfigurierbar als Konstanten im Code, nicht in DB):**

| Stufe | Normaler Vorlauf | Kurzfristig (< 60 Min.) |
|-------|-----------------|------------------------|
| T0: Erstbenachrichtigung | Bei Zuweisung | Bei Zuweisung |
| T+10m: Reminder 1 | +10 Minuten | +3 Minuten |
| T+25m: Reminder 2 + Kritisch | +25 Minuten | +8 Minuten |
| T+40m: Timeout + Eskalation | +40 Minuten | +15 Minuten |

### 6. Rejection Reasons: Enum + optionaler Freitext

**Optionen evaluiert:**

| Option | Vorteile | Nachteile |
|--------|----------|-----------|
| A) Enum `rejection_reason` | Aggregierbar, einheitlich | Starr, neue Gruende erfordern Migration |
| B) JSONB Freitext | Flexibel | Nicht aggregierbar ohne Aufwand |
| C) Enum + Freitext-Feld | Aggregierbar UND flexibel | Zwei Felder |

**Entscheidung: Option C -- Enum `rejection_reason` + optionales Freitext-Feld.**

Enum-Werte (vordefiniert, erweiterbar):
- `schedule_conflict` -- Terminkonflikt
- `too_far` -- Zu weit weg
- `vehicle_issue` -- Fahrzeugproblem
- `health` -- Gesundheitliche Gruende
- `personal` -- Persoenliche Gruende
- `other` -- Sonstiges (Freitext empfohlen)

Die Felder `rejection_reason_code` und `rejection_reason_text` leben auf `acceptance_tracking`, nicht auf `rides`. Der `rides`-Status wechselt nur zu `rejected` -- das "Warum" bleibt im Acceptance-Tracking.

### 7. Dispo-Queue: Neue Sub-Sektion auf der bestehenden Dispatch-Seite

**Entscheidung: Die bestehende `/dispatch`-Seite erhaelt eine neue Sektion "Wartend auf Antwort" oberhalb des Zuweisungs-Boards.**

Begruendung:
- Kein neuer Navigations-Einstiegspunkt noetig
- Dispatch ist der natuerliche Ort fuer Eskalations-Handling
- Die Queue zeigt alle `acceptance_tracking`-Eintraege im Status notified/reminder_1/reminder_2
- Jeder Eintrag: Countdown bis naechste Eskalation, Fahrer-Name, Fahrt-Daten, Stufe-Badge
- "Neu zuweisen"-Button leitet direkt zur Fahrer-Aenderung (reassign)

Tabs/Filter:
- "Alle wartenden" (Standard)
- "Erinnert" (Stufe reminder_1 oder reminder_2)
- "Timeout" (Stufe timed_out)
- "Abgelehnt" (Stufe rejected)

### 8. Feature-Flag: Environment Variable + DB-Spalte fuer Progressive Rollout

**Optionen evaluiert:**

| Option | Vorteile | Nachteile |
|--------|----------|-----------|
| A) Env-Variable `ACCEPTANCE_FLOW_ENABLED` | Einfach, kein DB-Aenderung, Vercel-nativ | Alles-oder-nichts pro Environment |
| B) DB-Flag `feature_flags`-Tabelle | Pro-Fahrer Rollout moeglich | Overengineered fuer MVP |
| C) Vercel Edge Config | Fast key-value reads | Vendor-Lock-in, Kosten |

**Entscheidung: Option A fuer den Start, mit einfacher Erweiterung auf driver-level Opt-in spaeter.**

`ACCEPTANCE_FLOW_ENABLED=true` aktiviert das gesamte Feature. Die `assignDriver()`-Funktion prueft dieses Flag -- bei `false` wird der bestehende M7-Flow (einfache E-Mail) ausgefuehrt.

Wenn granularer Rollout benoetigt wird: Ein `acceptance_flow_enabled`-Boolean auf der `drivers`-Tabelle ermoeglicht fahrer-spezifische Aktivierung. Das ist eine einzelne Spalte, keine Feature-Flag-Infrastruktur.

---

## Datenmodell-Aenderungen

### Neue Tabellen

#### `acceptance_tracking`

```sql
CREATE TYPE public.acceptance_stage AS ENUM (
  'notified', 'reminder_1', 'reminder_2',
  'confirmed', 'rejected', 'timed_out', 'cancelled'
);

CREATE TYPE public.rejection_reason AS ENUM (
  'schedule_conflict', 'too_far', 'vehicle_issue',
  'health', 'personal', 'other'
);

CREATE TYPE public.resolution_method AS ENUM (
  'driver_email', 'driver_app', 'dispatcher', 'timeout', 'system'
);

CREATE TABLE public.acceptance_tracking (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id               uuid          NOT NULL REFERENCES public.rides(id),
  driver_id             uuid          NOT NULL REFERENCES public.drivers(id),
  stage                 acceptance_stage NOT NULL DEFAULT 'notified',
  is_short_notice       boolean       NOT NULL DEFAULT false,
  notified_at           timestamptz   NOT NULL DEFAULT now(),
  reminder_1_at         timestamptz,
  reminder_2_at         timestamptz,
  resolved_at           timestamptz,
  resolved_by           resolution_method,
  rejection_reason_code rejection_reason,
  rejection_reason_text text,
  created_at            timestamptz   NOT NULL DEFAULT now()
);

-- Active tracking per ride (only one active at a time)
CREATE UNIQUE INDEX idx_acceptance_tracking_active_ride
  ON public.acceptance_tracking (ride_id)
  WHERE stage IN ('notified', 'reminder_1', 'reminder_2');

CREATE INDEX idx_acceptance_tracking_stage ON public.acceptance_tracking (stage);
CREATE INDEX idx_acceptance_tracking_driver ON public.acceptance_tracking (driver_id);
CREATE INDEX idx_acceptance_tracking_pending
  ON public.acceptance_tracking (notified_at)
  WHERE stage IN ('notified', 'reminder_1', 'reminder_2');
```

Der partielle Unique-Index `idx_acceptance_tracking_active_ride` stellt sicher, dass pro Fahrt hoechstens ein aktives Tracking existiert. Bei Reassign wird das alte Tracking auf `cancelled` gesetzt, bevor ein neues erstellt wird.

#### `assignment_tokens` -- Migration auf token_hash

```sql
-- Rename column and hash existing tokens
ALTER TABLE public.assignment_tokens RENAME COLUMN token TO token_hash;

-- Hash all existing plain tokens (one-time migration)
UPDATE public.assignment_tokens
SET token_hash = encode(sha256(token_hash::bytea), 'hex')
WHERE length(token_hash) = 64 AND token_hash ~ '^[0-9a-f]+$';

-- Recreate index on new column name
DROP INDEX IF EXISTS idx_assignment_tokens_token;
CREATE UNIQUE INDEX idx_assignment_tokens_token_hash
  ON public.assignment_tokens (token_hash);
```

### Geaenderte Tabellen

#### `mail_log` -- Template-Feld erweitert

Keine Schema-Aenderung noetig. Das `template`-Feld (text) akzeptiert neue Template-Namen:
- `driver-assignment` (bestehend)
- `driver-reminder-1` (neu)
- `driver-reminder-2` (neu)
- `dispatcher-escalation` (neu)

### RLS-Policies

```sql
ALTER TABLE public.acceptance_tracking ENABLE ROW LEVEL SECURITY;

-- Staff sees all
CREATE POLICY "Staff can view acceptance tracking"
  ON public.acceptance_tracking
  FOR SELECT
  USING (get_user_role() IN ('admin', 'operator'));

-- Drivers see their own
CREATE POLICY "Drivers can view own acceptance tracking"
  ON public.acceptance_tracking
  FOR SELECT
  USING (
    get_user_role() = 'driver'
    AND driver_id = get_user_driver_id()
  );

-- All writes via service-role client (no INSERT/UPDATE/DELETE policies)
```

---

## Zustandsdiagramm

```
                    Ride Status                 Acceptance Tracking
                    ===========                 ===================

                    unplanned
                        |
                   [assign driver]
                        |
                        v                       +-- notified
                     planned  <-- - - - - - - - |      |
                        |                       |   [T+10m, no response]
                        |                       |      v
                        |                       |   reminder_1
                        |                       |      |
                        |                       |   [T+25m, no response]
                        |                       |      v
                        |                       |   reminder_2
                        |                       |      |
                        |                       |   [T+40m, no response]
                        |                       |      v
                        |                       |   timed_out --> dispatcher alerted
                        |                       |
                   [driver confirms]            +-- confirmed
                        |
                        v
                    confirmed
                        |
                   [driver starts]
                        v
                    in_progress
                        |
                       ...

                   [driver rejects]             +-- rejected (with reason)
                        |
                        v
                     rejected
                        |
                   [reassign by dispo]          +-- cancelled (old tracking)
                        |                       +-- notified (new tracking, new driver)
                        v
                     planned
```

---

## Dateistruktur (Neue/Geaenderte Dateien)

### Neue Dateien

```
src/lib/acceptance/
  constants.ts              -- SLA-Fenster, Feature-Flag Check
  engine.ts                 -- Kern-Logik: checkAndEscalate(), resolveAcceptance()
  types.ts                  -- AcceptanceStage, RejectionReason TypeScript-Types

src/lib/mail/templates/
  driver-reminder.ts        -- Template fuer Reminder 1 und 2
  dispatcher-escalation.ts  -- Template fuer Dispatcher-Eskalation

src/actions/
  acceptance.ts             -- Server Actions: confirmRide, rejectRide (mit Reason), reassignDriver

src/components/acceptance/
  acceptance-queue.tsx       -- Dispatch-Seite: Warteschlange mit Countdown
  acceptance-card.tsx        -- Einzelkarte in der Queue (Countdown, Badges, Actions)
  rejection-dialog.tsx       -- Dialog fuer Ablehnungsgrund-Erfassung
  acceptance-badges.tsx      -- Stage-Badges (Neu, Erinnert, Ueberfaellig)

src/components/my-rides/
  pending-assignments.tsx    -- Fahrer-Seite: "Neue Zuweisungen"-Sektion

src/app/api/cron/
  acceptance-check/route.ts  -- Vercel Cron Endpoint

src/lib/validations/
  acceptance.ts              -- Zod-Schema fuer Rejection-Formular

src/lib/acceptance/__tests__/
  engine.test.ts             -- Unit-Tests fuer Escalation-Logik
  constants.test.ts          -- SLA-Fenster-Tests

supabase/migrations/
  20260305_000001_acceptance_tracking.sql
  20260306_000001_token_hashing.sql
```

### Geaenderte Dateien

```
src/lib/types/database.ts                -- Neue Tabelle + Enums
src/lib/rides/status-machine.ts          -- Keine Aenderung (!)
src/lib/mail/tokens.ts                   -- consumeToken: SHA-256 Vergleich
src/lib/mail/send-driver-notification.ts -- Erstellt acceptance_tracking Eintrag
src/actions/rides.ts                     -- assignDriver: Feature-Flag + Tracking
src/app/(dashboard)/dispatch/page.tsx    -- Acceptance-Queue Integration
src/app/(dashboard)/my/rides/page.tsx    -- Pending-Assignments Sektion
src/app/api/rides/respond/route.ts       -- Rejection-Reason Support, Idempotenz
src/components/my-rides/my-rides-list.tsx -- Acceptance-Badges
```

---

## Phasenplan

### Phase 1: Foundation (Issues #40, #41, #44) -- Woche 1

**Ziel: Datenmodell, Token-Hashing, ADR finalisiert**

1. ADR-012 finalisieren und mergen
2. Migration `20260305_000001_acceptance_tracking.sql`:
   - `acceptance_stage`, `rejection_reason`, `resolution_method` Enums
   - `acceptance_tracking` Tabelle mit Indexes und RLS
3. Migration `20260306_000001_token_hashing.sql`:
   - `token` -> `token_hash` Umbenennung
   - Bestehende Tokens einmalig hashen
4. `src/lib/types/database.ts` aktualisieren
5. `src/lib/mail/tokens.ts` auf SHA-256 umstellen
6. `src/lib/acceptance/constants.ts` mit SLA-Fenster-Konstanten
7. `src/lib/acceptance/types.ts` mit TypeScript-Types
8. Unit-Tests fuer Token-Hashing und SLA-Konstanten

**Abhaengigkeiten:** Keine
**Risiko:** Token-Migration koennte laufende Tokens invalidieren. Mitigation: Migration waehrend niedriger Last deployen (Abend). 48h-Expiry bedeutet, dass maximal 2 Tage alte Tokens betroffen sind.

### Phase 2: Engine + Templates (Issues #42, #46) -- Woche 2

**Ziel: Automatische Reminders funktionieren end-to-end**

1. `src/lib/acceptance/engine.ts`:
   - `createAcceptanceTracking(rideId, driverId)` -- erstellt Tracking bei Zuweisung
   - `checkPendingAcceptances()` -- findet alle faelligen Eskalationen
   - `escalateAcceptance(trackingId, nextStage)` -- fuehrt einzelne Eskalation durch
   - `resolveAcceptance(trackingId, method, rejectionCode?, rejectionText?)` -- schliesst Tracking
   - `cancelAcceptanceTracking(rideId)` -- bei Reassign/Cancel
2. `src/lib/mail/templates/driver-reminder.ts` -- Template mit Reminder-Stufe
3. `src/lib/mail/templates/dispatcher-escalation.ts` -- Eskalations-Mail an Disponenten
4. `src/app/api/cron/acceptance-check/route.ts`:
   - Authorization via `CRON_SECRET` Header (Vercel Cron Security)
   - Ruft `checkPendingAcceptances()` auf
   - Verarbeitet jede faellige Eskalation sequentiell
5. `vercel.json` Cron-Konfiguration: `{ "crons": [{ "path": "/api/cron/acceptance-check", "schedule": "* * * * *" }] }`
6. `src/actions/rides.ts` -- `assignDriver()` erweitern: Tracking erstellen
7. Integration-Tests fuer Engine

**Abhaengigkeiten:** Phase 1 (Datenmodell)
**Risiko:** Cron-Zuverlaessigkeit. Mitigation: Dispatch-Page-Load als Backup-Pruefung.

### Phase 3: Respond-Endpoint Hardening + Rejection (Issues #44, #47) -- Woche 2-3

**Ziel: Idempotente Entscheidungen, Rejection-Gruende, Audit**

1. `src/app/api/rides/respond/route.ts` erweitern:
   - Idempotenz: Wenn Token bereits konsumiert UND Ride bereits im Zielstatus -> Success (nicht Error)
   - Rejection-Reason: Optional via Query-Parameter oder POST-Body
   - Acceptance-Tracking Aufloesung bei Confirm/Reject
   - Audit: Jede Entscheidung in `acceptance_tracking.resolved_at/resolved_by` dokumentiert
2. `src/actions/acceptance.ts` -- Server Actions fuer In-App-Entscheidungen:
   - `confirmAssignment(rideId)` -- via /my/rides
   - `rejectAssignment(rideId, reasonCode, reasonText?)` -- via /my/rides
3. `src/lib/validations/acceptance.ts` -- Zod-Schema fuer Rejection-Formular

**Abhaengigkeiten:** Phase 2 (Engine)

### Phase 4: Driver UI (Issue #43) -- Woche 3

**Ziel: Fahrer sieht und beantwortet Zuweisungen in der App**

1. `src/components/my-rides/pending-assignments.tsx`:
   - Karten mit Acceptance-Badges ("Neu", "Erinnerung", "Ueberfaellig")
   - "Annehmen"-Button (direkte Server Action)
   - "Ablehnen"-Button (oeffnet Rejection-Dialog)
2. `src/components/acceptance/rejection-dialog.tsx`:
   - Select fuer Ablehnungsgruende
   - Optionales Freitextfeld
   - Submit via `rejectAssignment()` Server Action
3. `src/app/(dashboard)/my/rides/page.tsx` erweitern:
   - Neue Query: `acceptance_tracking` WHERE driver_id AND stage IN (notified, reminder_1, reminder_2)
   - "Neue Zuweisungen"-Sektion oberhalb der Tagesliste

**Abhaengigkeiten:** Phase 3 (Actions)

### Phase 5: Dispatch Queue UI (Issue #45) -- Woche 3-4

**Ziel: Disponenten sehen Warteschlange und koennen eingreifen**

1. `src/components/acceptance/acceptance-queue.tsx`:
   - Tabelle aller aktiven Acceptance-Trackings
   - Countdown-Timer (Client-Seite, basierend auf `notified_at` + SLA-Fenster)
   - Filter-Tabs: Wartend / Erinnert / Timeout / Abgelehnt
   - "Neu zuweisen"-Button pro Eintrag
2. `src/components/acceptance/acceptance-card.tsx`:
   - Fahrtdaten, Fahrer, Stufe-Badge, Countdown
   - Kommunikations-History (Mail-Log Eintraege)
3. `src/app/(dashboard)/dispatch/page.tsx` erweitern:
   - Neue Query fuer `acceptance_tracking`
   - `AcceptanceQueue`-Komponente oberhalb des Boards

**Abhaengigkeiten:** Phase 2 (Engine), unabhaengig von Phase 4

### Phase 6: Monitoring + QA (Issues #48, #49) -- Woche 4

**Ziel: KPIs sichtbar, Feature per Flag aktivierbar, Tests komplett**

1. Monitoring-Queries (SQL-basiert, keine separate Infrastruktur):
   - Median/P95 Time-to-Accept
   - Reminder-Rate (% Zuweisungen die mindestens 1 Reminder benoetigen)
   - Timeout-Rate
   - Rejection-Rate pro Fahrer
   - Durchschnittliche Reassign-Anzahl pro Fahrt
2. Optional: `/dispatch/stats`-Seite oder Inline-Statistik auf Dispatch-Seite
3. Feature-Flag-Integration in `assignDriver()`
4. Unit-Tests: Engine, Token-Hashing, SLA-Berechnung
5. Integration-Tests: Cron-Endpoint, Respond-Endpoint, Server Actions
6. E2E-Tests: Happy Path (Assign -> Notify -> Confirm), Rejection-Path, Timeout-Path

**Abhaengigkeiten:** Alle vorherigen Phasen

---

## Cron-Endpoint Sicherheit

```typescript
// src/app/api/cron/acceptance-check/route.ts
export async function GET(request: NextRequest) {
  // Vercel Cron sends CRON_SECRET in Authorization header
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const results = await checkPendingAcceptances()
  return Response.json({ processed: results.length })
}
```

`vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/acceptance-check",
    "schedule": "* * * * *"
  }]
}
```

---

## Aktualisiertes Token-Handling

```typescript
// tokens.ts -- nach Migration
import crypto from "crypto"

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function createAssignmentToken(
  rideId: string,
  driverId: string
): Promise<string> {
  const token = generateToken()        // 256-bit random
  const tokenHash = hashToken(token)   // SHA-256 stored in DB

  await supabase.from("assignment_tokens").insert({
    ride_id: rideId,
    driver_id: driverId,
    token_hash: tokenHash,
    expires_at: expiresAt,
  })

  return token  // plaintext returned for email URL
}

export async function consumeToken(token: string): Promise<...> {
  if (!TOKEN_FORMAT.test(token)) return null
  const tokenHash = hashToken(token)

  const { data } = await supabase
    .from("assignment_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token_hash", tokenHash)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("id, ride_id, driver_id")
    .single()

  return data ?? null
}
```

---

## Engine-Pseudocode

```typescript
// src/lib/acceptance/engine.ts

export async function checkPendingAcceptances(): Promise<EscalationResult[]> {
  const supabase = createAdminClient()
  const now = new Date()

  // Fetch all active (non-resolved) trackings
  const { data: pending } = await supabase
    .from("acceptance_tracking")
    .select("*")
    .in("stage", ["notified", "reminder_1", "reminder_2"])

  const results: EscalationResult[] = []

  for (const tracking of pending ?? []) {
    const windows = tracking.is_short_notice
      ? SHORT_NOTICE_WINDOWS
      : NORMAL_WINDOWS

    const minutesSinceNotified = diffMinutes(now, tracking.notified_at)

    if (tracking.stage === "notified" && minutesSinceNotified >= windows.reminder1) {
      await escalateToStage(tracking, "reminder_1", now)
      results.push({ id: tracking.id, action: "reminder_1" })
    }
    else if (tracking.stage === "reminder_1" && minutesSinceNotified >= windows.reminder2) {
      await escalateToStage(tracking, "reminder_2", now)
      results.push({ id: tracking.id, action: "reminder_2" })
    }
    else if (tracking.stage === "reminder_2" && minutesSinceNotified >= windows.timeout) {
      await escalateToStage(tracking, "timed_out", now)
      await notifyDispatcher(tracking)
      results.push({ id: tracking.id, action: "timed_out" })
    }
  }

  return results
}
```

---

## Risikobewertung

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| Vercel Cron faellt aus / verzoegert | Niedrig | Mittel | Supplementaere Pruefung bei Dispatch-Page-Load. Mail-Log zeigt Luecken. |
| Token-Migration invalidiert aktive Tokens | Niedrig | Niedrig | Migration abends deployen. Max 48h-alte Tokens betroffen. Fahrer koennen im App reagieren. |
| Doppelte E-Mails bei Cron-Race | Niedrig | Niedrig | Idempotenz: `reminder_1_at IS NULL` als Bedingung im UPDATE. Nur ein Cron-Aufruf gewinnt. |
| Fahrer erhaelt Reminder nach bereits erfolgter Reaktion | Niedrig | Niedrig | `resolveAcceptance()` setzt Stage auf confirmed/rejected. Cron prueft nur Stages notified/reminder_1/reminder_2. |
| Feature-Flag vergessen bei Rollback | Mittel | Mittel | Env-Variable mit default `false`. Bestehender M7-Flow ist Fallback. |
| ride_form.tsx Komplexitaet | Mittel | Niedrig | Acceptance-Flow ist unabhaengig vom Ride-Formular. Aenderungen betreffen `assignDriver()` und `/my/rides`, nicht das Formular. |

---

## Konsequenzen

### Positiv
- Automatisierte Eskalation reduziert manuellen Dispatch-Aufwand um geschaetzt 60-80%
- Strukturierte Ablehnungsgruende ermoeglichen datengetriebene Verbesserungen
- Token-Hashing schliesst eine Sicherheitsluecke (Klartext-Tokens in DB)
- Saubere Trennung Ride-Lifecycle vs. Notification-Lifecycle
- Bestehende Status-Machine bleibt unveraendert -- kein Regressions-Risiko
- Feature-Flag ermoeglicht schrittweisen Rollout

### Negativ
- 3 neue Enums und 1 neue Tabelle erhoehen DB-Komplexitaet
- Vercel Cron (1x/min) ist nicht sekundengenau -- fuer 10-Minuten-Fenster akzeptabel
- Zwei Kanaele (E-Mail + App) fuer Fahrer-Reaktion erhoehen die Testflaeche

### Abgrenzung (nicht in diesem ADR)
- Push-Notifications (Mobile) -- erfordert native App oder PWA
- Automatische Fahrer-Vorschlaege basierend auf Verfuegbarkeit/Naehe
- Multi-Fahrer-Anfrage (gleichzeitig mehrere Fahrer anschreiben)
- Voll-automatischer Reassign bei Timeout (menschliche Entscheidung bevorzugt)
