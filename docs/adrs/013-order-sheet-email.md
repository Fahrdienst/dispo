# ADR-013: Auftragsblatt-Mail (M11)

## Status
Proposed

## Kontext

Das bestehende E-Mail-Template fuer Fahrerzuweisungen (`driver-assignment.ts`) zeigt nur minimale Informationen: Fahrername, Patientenname, Zielname, Datum, Abholzeit, Richtung. Analog zur alten Access-Vorlage soll ein vollstaendiges "Auftragsblatt" per E-Mail an den Fahrer gesendet werden, das alle relevanten Informationen fuer den Transport enthaelt.

Die alte Vorlage enthaelt Felder (Anrede, Auftragstyp, Auftraggeber, Disponent, Telefon/Mobile getrennt, Doppelpreis, Mehrkosten), die im neuen Datenmodell nicht existieren. Es muss entschieden werden, wie mit diesen Luecken umgegangen wird.

## Optionen

### Template-Technologie

1. **HTML-String mit Section-Funktionen** (empfohlen) -- Bestehenden Ansatz beibehalten, aber in modulare Render-Funktionen aufteilen. Kein neues Dependency.
2. **React Email** -- Component-basierte E-Mail-Komposition. Neue Dependency, eigener Dev-Server fuer Vorschau. Overkill fuer ein einzelnes Template.
3. **MJML** -- E-Mail-spezifisches Markup. Compile-Schritt noetig, eigene Syntax. Zu viel Overhead fuer den Scope.

### PDF-Generierung

1. **Weglassen in M11, nachholen in M12** (empfohlen) -- HTML-Template so gestalten, dass es druckbar ist. PDF spaeter.
2. **@react-pdf/renderer** -- Pure JS, Vercel-kompatibel. Erfordert separates PDF-Layout.
3. **Externer API-Service** -- Einfachste Loesung, aber externe Abhaengigkeit und Kosten.

### Fehlende Felder

1. **Pragmatischer Ansatz** (empfohlen) -- Nur vorhandene Felder anzeigen, fehlende Felder weglassen. Kein Schema-Aenderung fuer M11.
2. **Schema erweitern** -- `patients.salutation`, `patients.phone_mobile`, `drivers.phone_mobile`, `rides.assigned_by`, `rides.order_number` hinzufuegen. Hoher Aufwand (Migration + Forms + Validation + Tests).

## Entscheidung

### E1: HTML-String beibehalten, modular aufteilen

Das Template wird als modulares HTML-String-System implementiert:

```
src/lib/mail/templates/
  order-sheet.ts              -- assembleOrderSheet(): Hauptfunktion
  sections/
    header.ts                 -- renderHeader()
    patient-block.ts          -- renderPatientBlock()
    destination-block.ts      -- renderDestinationBlock()
    driver-block.ts           -- renderDriverBlock()
    cost-summary.ts           -- renderCostSummary()
    action-buttons.ts         -- renderActionButtons()
    footer.ts                 -- renderFooter()
  utils.ts                    -- formatDate(), formatCHF(), escapeHtml()
```

Begruendung: Konsistenz mit bestehendem Codebase. Kein neues Dependency. Die modulare Struktur macht das grosse Template wartbar und testbar.

### E2: Dediziertes Data-Loading

Neue Funktion `loadOrderSheetData(rideId, driverId)` in `src/lib/mail/load-order-sheet-data.ts`:
- Laedt Fahrt mit allen Relationen in einem Supabase-Query
- Laedt Patient-Impairments separat
- Gibt typisiertes `OrderSheetData`-Interface zurueck
- Wiederverwendbar fuer Mail-Versand und Preview-Route

### E3: Preview als Route Handler

```
GET /api/mail/preview?ride_id=<uuid>
```

- Authentifiziert (admin/operator only)
- Rendert HTML-Template mit echten Daten
- Gibt `Content-Type: text/html` zurueck
- Kein Versand, nur Anzeige

### E4: Fehlende Felder pragmatisch behandeln

Folgende Felder aus der Access-Vorlage werden **nicht** abgebildet (kein Schema-Aenderung):

| Feld | Entscheidung | Alternative |
|---|---|---|
| Anrede (Herr/Frau) | Weglassen | Nur Name anzeigen |
| Auftragstyp | Weglassen | `vehicle_type` des Fahrers in Fahrer-Block zeigen |
| Auftraggeber | Weglassen | Kein Konzept im neuen System |
| Disponent | Weglassen oder statisch | Kein `assigned_by`-Feld |
| Telefon + Mobile (getrennt) | Ein Feld | `phone` als "Telefon / Mobile" anzeigen |
| Auftrags-Nr. (fortlaufend) | UUID-Kurzform | `F-{YYMMDD}-{last4}` |
| Doppelpreis | Berechnen | Effektivpreis bei `direction=both` verdoppeln |
| Mehrkosten | Weglassen | Existiert nicht im Schema |

Diese Felder koennen in einem spaeteren Milestone (M13+) nachgeruestet werden, falls noetig.

### E5: PDF in M12 verschieben

PDF-Generierung wird nicht in M11 implementiert. Stattdessen:
- HTML-Template wird mit Print-optimierten Styles versehen
- Fahrer kann aus E-Mail-Client direkt drucken
- PDF wird als eigenes Issue in M12 nachgeliefert mit `@react-pdf/renderer`

### E6: Shared Mail-Utilities konsolidieren

Vor den Template-Issues wird `formatDate()` (4x dupliziert) und `DIRECTION_LABELS` (3x dupliziert, inkonsistent mit `RIDE_DIRECTION_LABELS`) in `src/lib/mail/utils.ts` konsolidiert. Neue Utilities:
- `escapeHtml()` -- XSS-Schutz fuer User-Daten in HTML-Templates
- `formatCHF()` -- Einheitliche Waehrungsformatierung ("Fr. 65.00")
- `formatTime()` -- "14:30" aus "14:30:00"

### E7: Bestehende Accept/Reject-Tokens bleiben unveraendert

Die Token-basierte Accept/Reject-Logik (M7/M9) bleibt exakt wie implementiert. Die Buttons werden lediglich ans Ende des erweiterten Templates verschoben. Kein Refactoring der Token-Infrastruktur.

## Implementierungs-Reihenfolge

```
Phase 1 (Fundament):
  M11-0: Shared Mail-Utilities + OrderSheetData-Interface
  M11-5 (#56): Data Loading erweitern

Phase 2 (Template-Bloecke, parallelisierbar):
  M11-1 (#52): Header
  M11-2 (#53): Fahrgast-Block
  M11-3 (#54): Ziel-Block
  M11-4 (#55): Fahrer-Block

Phase 3 (Integration):
  M11-6 (#57): Kosten-Anzeige
  M11-8 (#59): Accept/Reject-Buttons

Phase 4 (QA):
  M11-9 (#60): Tests + Vorschau-Route

Phase 5 (Spaeter, M12):
  M11-7 (#58): PDF-Generierung
```

## Konsequenzen

### Positiv
- Kein Schema-Aenderung noetig -- M11 ist reines Frontend/Template-Refactoring
- Modulare Template-Architektur ist leicht wartbar und testbar
- Wiederverwendbare Utilities eliminieren Code-Duplikation
- Preview-Route ermoeglicht QA ohne E-Mail-Versand
- Backward-kompatibel: Bestehende Token-Logik bleibt unveraendert

### Negativ
- Das Auftragsblatt wird nicht 1:1 wie die Access-Vorlage aussehen (fehlende Felder)
- Fahrer erhalten vorerst kein PDF zum Ausdrucken
- HTML-String-Templates haben keinen Compile-Time-Check fuer HTML-Validitaet

### Risiken
- **E-Mail-Client-Rendering**: Inline-CSS ist fragil. Testen in Gmail, Outlook, Apple Mail erforderlich.
- **Daten-Vollstaendigkeit**: Wenn Felder (phone, comment, etc.) null sind, muss das Template sauber mit leeren Bloecken umgehen.
- **Performance**: Die erweiterte Query laedt deutlich mehr Daten. Bei >100 Benachrichtigungen pro Tag koennte das relevant werden (aktuell: ~10-20/Tag, kein Problem).

### Technische Schuld
- `formatDate()` ist 4x dupliziert -- wird durch M11-0 behoben
- `DIRECTION_LABELS` weicht von `RIDE_DIRECTION_LABELS` ab -- wird durch M11-0 behoben
- `patients.comment` vs. `patients.notes`: Semantik muss dokumentiert werden
