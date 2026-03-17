# Dispo-Flow Rollout-Plan

## Übersicht

Stufenweises Rollout des neuen Dispositions-Flows mit Feature-Flag-Steuerung.

**Feature Flag:** `FEATURE_NEW_DISPO_FLOW=true`

---

## Phase 1: Interner Test (Entwickler)

**Dauer:** 3–5 Arbeitstage
**Teilnehmer:** Entwicklungsteam (2–3 Personen)

### Aktivitäten
- Feature Flag auf Staging aktivieren (`FEATURE_NEW_DISPO_FLOW=true`)
- Alle Kernflows manuell durchtesten:
  - Fahrt erstellen (Einzel + Serie)
  - Fahrer zuweisen / entfernen
  - Statusübergänge (unplanned → planned → dispatched → completed)
  - Rückfahrt-Erstellung
  - Preisberechnung
- Edge Cases prüfen:
  - Fahrt ohne Geocoding-Daten
  - Fahrt ohne verfügbare Fahrer
  - Parallelzuweisung desselben Fahrers
- Telemetrie-Events im Log verifizieren

### Go/No-Go Kriterien
- [ ] Alle Kernflows funktionieren fehlerfrei
- [ ] Keine TypeScript-Kompilierungsfehler (`npx tsc --noEmit`)
- [ ] Telemetrie-Events werden korrekt geloggt
- [ ] Kein Datenverlust bei Statusübergängen
- [ ] RLS-Policies greifen korrekt (Fahrer sehen nur eigene Fahrten)

---

## Phase 2: Pilot (2–3 Disponenten)

**Dauer:** 1 Woche
**Teilnehmer:** 2–3 erfahrene Disponenten + 1 Entwickler als Ansprechperson

### Vorbereitung
- Pilotgruppe auswählen und briefen
- Support-Runbook bereitstellen (siehe `docs/runbooks/dispo-support.md`)
- Monitoring-Dashboard einrichten (Telemetrie-Events)
- Feature Flag auf Production für Pilotgruppe aktivieren

### Aktivitäten
- Tägliche Nutzung im realen Betrieb
- Tägliches Kurzfeedback (5 min Standup oder Slack-Nachricht)
- Entwickler prüft täglich Telemetrie und Fehler-Logs

### Metriken (Kernmetriken)
- **Time-to-Capture:** Zeit von Fahrtanfrage bis Fahrt im System
- **Zuweisungsquote:** Anteil Fahrten mit Fahrer-Zuweisung am Vortag
- **Fehlerrate:** Fehlgeschlagene Aktionen pro Tag
- **Akzeptanzrate:** Anteil bestätigter Fahrerzuweisungen (wenn Acceptance Flow aktiv)

### Go/No-Go Kriterien
- [ ] Fehlerrate < 2% aller Aktionen
- [ ] Kein kritischer Bug in der Pilotwoche
- [ ] Positives Feedback von mindestens 2/3 der Pilotnutzer
- [ ] Keine Datenverluste oder -inkonsistenzen
- [ ] Durchschnittliche Time-to-Capture verbessert oder gleichwertig

---

## Phase 3: Vollrollout

**Dauer:** 1–2 Wochen Übergangszeit
**Teilnehmer:** Alle Disponenten und Fahrer

### Aktivitäten
- Feature Flag für alle aktivieren (`FEATURE_NEW_DISPO_FLOW=true`)
- Kurzschulung (30 min) für alle Disponenten
- Erste Woche: Erhöhte Monitoring-Aufmerksamkeit
- Zweite Woche: Stabilisierungsphase

### Go/No-Go Kriterien
- [ ] Phase 2 erfolgreich abgeschlossen
- [ ] Alle bekannten Bugs aus Pilotphase behoben
- [ ] Schulungsmaterial vorhanden
- [ ] Rollback-Strategie getestet

---

## Rollback-Strategie

### Sofort-Rollback (< 5 Minuten)
1. Feature Flag deaktivieren: `FEATURE_NEW_DISPO_FLOW=false`
2. Vercel Deployment bleibt bestehen, nur das Flag wird geändert
3. Kein Datenverlust — alle Fahrten bleiben im System

### Vollständiger Rollback
1. Feature Flag deaktivieren
2. Bei Bedarf: vorheriges Deployment auf Vercel wiederherstellen
3. Datenbank-Migrationen sind vorwärtskompatibel (kein Schema-Rollback nötig)

### Eskalation
- **Stufe 1:** Feature Flag deaktivieren (Disponent oder Entwickler)
- **Stufe 2:** Vorheriges Deployment wiederherstellen (Entwickler)
- **Stufe 3:** Datenbankeingriff (nur mit DBA-Zugang, nach Rücksprache)
