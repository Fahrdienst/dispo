# ADR-011: Dispo-Flow End-to-End Workflow

## Status

Accepted

## Date

2026-02-21

## Kontext

Das Dispo-System ermoeglicht die Verwaltung von Krankentransportfahrten. Der haeufigste Anwendungsfall ist: Disponent nimmt einen Telefonanruf entgegen, erfasst eine neue Fahrt und weist spaeter einen Fahrer zu. Bisher erforderte dies mehrere Schritte ueber verschiedene Seiten (Patient anlegen, Ziel anlegen, Fahrt erstellen, Fahrtserie separat verwalten).

### Ziel

Minimale Eingabezeit, kein Kontextwechsel -- der gesamte Dispo-Workflow soll aus dem Ride-Formular heraus steuerbar sein.

### Bestehendes Datenmodell (vor M9)

- `rides`: `patient_id`, `destination_id`, `date`, `pickup_time`, `direction`, `status`, `driver_id`, `parent_ride_id`, `appointment_time`, `appointment_end_time`, `return_pickup_time`, `ride_series_id`
- `ride_series`: `patient_id`, `destination_id`, `recurrence_type`, `days_of_week`, `pickup_time`, `direction`, `start_date`, `end_date`
- Auto-Rueckfahrt via `parent_ride_id`-Linking bereits implementiert

### Zugehoerige Issues

#28 ADR Dispo-Flow, #29 Serienfahrt-Erweiterung, #30 Auto-Zeitberechnung, #31 Timeline-Visualisierung, #32 Inline-Patient, #33 Inline-Ziel, #34 Serien-Toggle, #35 Prozessschnitt-Hinweis, #36 Validierung

## Entscheidungen

### 1. Pickup-Vorschlag als Empfehlung (nicht Auto-Set)

Die vorgeschlagene Abholzeit wird als Hinweis mit "Uebernehmen"-Button angezeigt, nicht automatisch gesetzt. Begruendung: `pickup_time` ist NOT NULL und operativ kritisch -- der Disponent muss die Kontrolle behalten.

Formel: `appointment_time - ceil(duration_seconds / 60) - 5 Min. Puffer`

### 2. Timeline als inkrementelles Sidebar-Panel

Die Tagesablauf-Timeline wird als sticky Sidebar rechts vom Formular angezeigt (280px, responsive). Keine Umstrukturierung des bestehenden Formulars noetig -- minimales Risiko.

Eintraege: Abholung, Ankunft Ziel (Auto), Terminbeginn, Terminende, Rueckfahrt-Abholung, Ankunft zuhause (Auto). Farbkodierung: Primary (manuell), Amber (Vorschlag), Muted (berechnet).

### 3. Inline-Anlage via Dialog (nicht Sheet)

Patienten und Ziele koennen direkt aus dem Ride-Formular ueber modale Dialoge angelegt werden. Maximale Feldanzahl: 5-6 (Name, Telefon, Adresse). Bewaehrtes Pattern (identisch zu `GenerateRidesDialog`).

Neue Eintraege werden sofort in die Select-Listen eingefuegt und automatisch ausgewaehlt. Dialoge werden ausserhalb des `<form>` gerendert, um verschachtelte Formulare zu vermeiden.

### 4. Fahrtserie als Supplement, nicht Replacement

Der bestehende `/ride-series/`-CRUD bleibt fuer die Verwaltung bestehender Serien erhalten. Das Ride-Formular bietet zusaetzlich einen "Als Fahrtserie anlegen"-Toggle, der eine Serie inline erstellt.

### 5. Separater Server Action fuer Serien-Erstellung

`createRideWithSeries` ist ein eigenstaendiger Server Action (nicht in `createRide` integriert). `createRide` delegiert an `createRideWithSeries` wenn das Hidden-Field `enable_series=true` gesetzt ist. Begruendung: `createRide` ist bereits 150+ Zeilen -- Separation of Concerns.

### 6. Terminzeiten auf ride_series erweitert

`ride_series` erhaelt drei neue Spalten: `appointment_time`, `appointment_end_time`, `return_pickup_time`. Generierte Fahrten uebernehmen diese Werte. Bei `direction=both` wird die Hinfahrt zuerst eingefuegt, die Rueckfahrt erhaelt `parent_ride_id`.

### 7. Prozessschnitt: Fahrer-Zuweisung ist optional

Unter dem Fahrer-Select im Formular steht ein Hinweistext: "Optional -- Fahrer kann spaeter im Disposition-Board zugewiesen werden." Dies verdeutlicht den Zwei-Phasen-Workflow (Erfassung → Disposition).

## Neue/Geaenderte Dateien

| Datei | Aenderung |
|---|---|
| `src/lib/rides/time-calc.ts` | Neue reine Funktion `calculateRideTimes()` |
| `src/lib/rides/__tests__/time-calc.test.ts` | 16 Tests fuer Zeitberechnung |
| `src/lib/validations/rides.ts` | `subtractMinutesFromTime()`, `DEFAULT_PICKUP_BUFFER_MINUTES` |
| `src/lib/validations/ride-series.ts` | 3 optionale Terminzeit-Felder |
| `src/lib/types/database.ts` | `ride_series` Row/Insert/Update erweitert |
| `src/components/rides/ride-form.tsx` | Inline-Dialoge, Timeline, Pickup-Vorschlag, Zwei-Spalten-Layout, Serien-Toggle |
| `src/components/rides/ride-timeline.tsx` | Neue Timeline-Komponente |
| `src/components/patients/patient-inline-dialog.tsx` | Inline-Patient-Anlage |
| `src/components/destinations/destination-inline-dialog.tsx` | Inline-Ziel-Anlage |
| `src/actions/rides.ts` | `createRideWithSeries()` |
| `src/actions/patients.ts` | `createPatientInline()` |
| `src/actions/destinations.ts` | `createDestinationInline()` |
| `src/components/dispatch/dispatch-board.tsx` | Terminzeit-Anzeige, Rueckfahrt-Badge |
| `src/app/(dashboard)/dispatch/page.tsx` | Query erweitert |
| `supabase/migrations/20260304_000001_...` | `ride_series` Terminzeit-Spalten |

## Konsequenzen

### Positiv

- Dispatcherin kann den kompletten Workflow ohne Seitenwechsel durchfuehren
- Zeitvorschlaege reduzieren Eingabefehler
- Timeline gibt visuelles Feedback ueber den Tagesablauf
- Bestehende CRUD-Seiten bleiben unveraendert

### Negativ / Risiken

- `ride-form.tsx` ist mit ~760 Zeilen die groesste Komponente im Projekt
- Inline-Anlage hat reduzierte Felder (keine Beeintraechtigungen, keine Kontaktperson)
- Serien-Erstellung im Ride-Form erzeugt Daten auf zwei Tabellen in einer Action

### Abgrenzung (nicht in diesem ADR)

- Performance-Budget und Keyboard-First (Issue #37)
- E2E-Tests (Issue #38)
- Rollout und Feature-Flags (Issue #39)
