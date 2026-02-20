# ADR 007: Fahrtserien-Modell (Ride Series)

## Status

Accepted

## Date

2026-02-20

## Context

Patienten haben haeufig wiederkehrende Fahrten (z.B. Dialyse 3x/Woche). Einzelne Fahrten manuell zu erstellen ist fehleranfaellig und zeitaufwaendig. Wir brauchen ein Serienmodell, das wiederkehrende Fahrten beschreibt und daraus Einzelfahrten generiert.

## Decision

### Lifecycle

1. **Create**: Operator/Admin erstellt eine Fahrtserie mit Patient, Ziel, Wiederholungstyp, Wochentagen, Abholzeit, Richtung, Start-/Enddatum.
2. **Active**: Serie ist aktiv (`is_active = true`), Fahrten koennen generiert werden.
3. **Pause**: Serie wird pausiert (`is_active = false`), keine neuen Fahrten generierbar. Bestehende Fahrten bleiben unveraendert.
4. **End**: Serie hat ein `end_date`, danach werden keine Fahrten mehr generiert.

### Generation

- **Manuelle Ausloesung**: Operator klickt "Fahrten generieren" mit einem Datumshorizont (Standard: 14 Tage).
- **Kein Cron pre-MVP**: Automatische Generierung wird spaeter ergaenzt.
- Generierte Fahrten erhalten Status `unplanned`, keinen Fahrer, und die `ride_series_id` der Serie.

### Change Semantics

- **Forward-only**: Aenderungen an der Serie betreffen nur zukuenftig generierte Fahrten.
- **Bestehende Fahrten bleiben unveraendert**: Bereits generierte Fahrten werden nicht modifiziert.

### Direction "both"

- Erzeugt 2 Fahrten pro Datum: eine `outbound` und eine `return`.

### No Driver on Series Level

- Fahrer werden auf Einzelfahrt-Ebene zugewiesen, nicht auf Serienebene.

### Duplicate Prevention

- Unique partial index: `(ride_series_id, date, pickup_time, direction) WHERE ride_series_id IS NOT NULL`
- Insert-Strategie: Einzelne Inserts pro Fahrt, Constraint-Verletzungen werden uebersprungen (idempotente Generierung).

### Recurrence Types

- **daily**: Jeden Tag im Zeitraum.
- **weekly**: Nur an den ausgewaehlten Wochentagen.
- **biweekly**: Wie weekly, aber nur jede zweite Woche (Paritaet basiert auf `start_date`).
- **monthly**: Gleicher Tag des Monats wie `start_date`. Uebersprungen wenn Tag im Monat nicht existiert.

## Consequences

- Idempotente Generierung: mehrfaches Ausloesen erzeugt keine Duplikate.
- Einfaches Modell ohne Scheduling-Komplexitaet.
- Spaetere Erweiterung um automatische Generierung (Cron/Edge Function) moeglich.
- Bestehende Fahrten-Logik (Status-Machine, Fahrerzuweisung) bleibt unveraendert.
