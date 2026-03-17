# Dispo-Flow Support-Runbook

## Übersicht

Dieses Runbook beschreibt häufige Probleme im Dispositions-Flow und deren Lösungen.

---

## 1. Häufige Probleme und Lösungen

### Fahrt hat den Status "unplanned" obwohl ein Fahrer zugewiesen wurde

**Ursache:** Die automatische Transition `unplanned → planned` greift nur bei der Zuweisung über `assignDriver`. Direkte DB-Änderungen umgehen die Logik.

**Lösung:**
1. Fahrer über die Dispatch-Ansicht zuweisen (nicht direkt in der DB)
2. Falls bereits zugewiesen: Status manuell ändern (siehe Abschnitt 2)

### Fahrer sieht zugewiesene Fahrt nicht

**Mögliche Ursachen:**
- Fahrer-Account ist deaktiviert (`is_active = false` in `drivers` Tabelle)
- RLS-Policy `rides_select_driver` prüft `is_active = true`
- Fahrt ist deaktiviert (`is_active = false` in `rides` Tabelle)

**Lösung:**
1. Prüfen: Ist der Fahrer aktiv? (`drivers.is_active`)
2. Prüfen: Ist die Fahrt aktiv? (`rides.is_active`)
3. Prüfen: Ist der Fahrer korrekt zugewiesen? (`rides.driver_id`)

### Preisberechnung zeigt keinen Preis an

**Ursache:** Geocoding fehlt für Patient oder Ziel, oder keine passende Tarifzone.

**Lösung:**
1. Geocoding-Status prüfen: Patient und Ziel müssen `geocode_status = 'success'` haben
2. Falls fehlend: Geocoding über Einstellungen > Geocoding erneut auslösen
3. Tarifzonen prüfen: Beide PLZ müssen einer Zone zugeordnet sein

### E-Mail an Fahrer wurde nicht gesendet

**Ursache:** SMTP-Konfiguration fehlt, Fahrer hat keine E-Mail, oder Mail-Transport-Fehler.

**Lösung:**
1. SMTP-Einstellungen prüfen (siehe `.env.example`)
2. Fahrer-E-Mail prüfen: `drivers.email` oder `profiles.email` muss vorhanden sein
3. Logs prüfen: Fehlermeldungen im Server-Log suchen (`[mail]` Prefix)

---

## 2. Fahrtstatus manuell ändern

### Über die Anwendung (empfohlen)
1. Fahrt in der Wochenansicht (/rides) oder Dispatch-Ansicht (/dispatch) öffnen
2. Auf den Status-Button klicken
3. Gewünschten Zielstatus auswählen
4. Erlaubte Übergänge werden durch die Status-Machine erzwungen

### Erlaubte Statusübergänge (Operator/Admin)
- `unplanned` → `planned` (automatisch bei Fahrerzuweisung)
- `planned` → `dispatched`, `cancelled`
- `dispatched` → `in_progress`, `cancelled`
- `in_progress` → `completed`, `no_show`
- `planned` → `unplanned` (automatisch bei Fahrer-Entfernung)

### Über Supabase Dashboard (Notfall)
1. Supabase Dashboard öffnen
2. Table Editor → `rides` Tabelle
3. Fahrt per ID suchen
4. `status` Feld ändern
5. **Achtung:** Umgeht die Status-Machine-Validierung — nur im Notfall verwenden

---

## 3. Fahrer manuell zuweisen

### Über die Dispatch-Ansicht (empfohlen)
1. /dispatch öffnen
2. Auf eine unzugewiesene Fahrt klicken
3. Im Detail-Panel den Fahrer aus dem Dropdown auswählen
4. Speichern — Status wird automatisch auf `planned` gesetzt

### Über die Fahrt-Bearbeitung
1. /rides öffnen, Fahrt suchen
2. "Bearbeiten" klicken
3. Im Formular den Fahrer auswählen
4. Speichern

---

## 4. Geocoding-Fehler beheben

### Einzelner Patient/Ziel
1. Patienten- oder Ziel-Detailseite öffnen
2. Adressfelder prüfen (Strasse, Hausnummer, PLZ, Ort)
3. Adresse korrigieren und speichern
4. Geocoding wird automatisch beim Speichern ausgelöst

### Batch-Korrektur (mehrere Einträge)
1. Einstellungen → Geocoding öffnen
2. "Geocoding erneut auslösen" Karte verwenden
3. Status der Einträge wird aktualisiert

### Häufige Geocoding-Probleme
- **Falsche PLZ:** Schweizer PLZ haben 4 Stellen (z.B. 8001, nicht 80001)
- **Fehlende Hausnummer:** Google Maps braucht Hausnummer für genaue Koordinaten
- **Umlaute:** Strasse/Ort mit Umlauten können Probleme machen — Standardschreibweise verwenden

---

## 5. Feature Flags

### Neuen Dispo-Flow aktivieren/deaktivieren
- Environment Variable: `FEATURE_NEW_DISPO_FLOW`
- Wert `true` = aktiviert, alles andere = deaktiviert
- Änderung erfordert Neustart/Redeployment

### Acceptance Flow (Fahrer-Bestätigung)
- Environment Variable: `ACCEPTANCE_FLOW_ENABLED`
- Aktiviert E-Mail-basierte Fahrer-Bestätigung mit SLA-Eskalation

### Alle Flags anzeigen
- Siehe `src/lib/feature-flags.ts` für die vollständige Liste
- Auf der Admin-Seite unter System-Übersicht einsehbar

---

## 6. Kontaktpersonen

| Rolle | Zuständigkeit |
|-------|---------------|
| **Entwickler** | Technische Probleme, Deployments, Datenbankeingriffe |
| **Disponent (Lead)** | Fachliche Fragen, Pilotfeedback |
| **Admin** | Benutzerverwaltung, Berechtigungen |

---

## 7. Telemetrie / Monitoring

### Wichtige Events prüfen
- `ride_created` — Fahrt erfolgreich erstellt
- `login_success` / `login_failed` — Anmeldeversuche
- `login_mfa_required` — MFA-Aufforderung ausgelöst

### Logs
- **Development:** Events im Console-Log (`[telemetry]` Prefix)
- **Production:** Strukturierte JSON-Logs (Vercel Log Drain oder Datadog)
- **Audit Trail:** `audit_log` Tabelle in Supabase (nur Admin lesbar)
