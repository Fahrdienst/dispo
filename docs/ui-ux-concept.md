# Fahrdienst App — Vollständiges UI/UX-Konzept

**Version:** 1.0
**Erstellt:** 2026-03-16
**Autor:** Kim (Senior UI/UX Designerin)
**Status:** Entwurf zur Umsetzung

---

## Ausgangslage (Ist-Zustand)

Vor der Konzepterstellung wurde die bestehende Codebase analysiert. Die App befindet sich bereits in einem funktionierenden Zustand mit folgenden etablierten Mustern:

- **Header:** Sticky, dunkel (`bg-slate-900/85`), 62px, horizontale Navigation mit 10+ Items, Icons + Labels
- **Layout:** `max-w-7xl` zentriert, `py-8` Innenabstand, cyan Activity-Banner oben
- **Designsprache:** `glass-panel` Cards (`border border-white/70 bg-white/80 shadow-xl backdrop-blur`), `rounded-2xl`
- **Primärfarbe:** `hsl(211 96% 42%)` — ein klares Blau
- **Typografie:** Inter via `next/font/google`, `font-feature-settings: "tnum"`, Letter-Spacing -0.02em auf Headings
- **Status-Tokens:** 10 Status-Variablen in `globals.css`, vollständig in `tailwind.config.ts` gemappt
- **Komponenten:** shadcn/ui, neutral theme, Lucide Icons, Button mit leichtem Hover-Lift-Effekt
- **Fahrer-Ansicht:** Mobile Cards mit `text-3xl` Zeitanzeige, `h-12` Action-Buttons, Status-Left-Border
- **Disposition:** DispatchBoard mit Fahrtenliste + 320px Driver-Sidebar, Wochenkalender-Ansicht vorhanden
- **Formulare:** `useFormState` (React 18), Zod-Validierung, Server Actions

Das Konzept baut auf diesem Fundament auf. Empfehlungen, die dem bestehenden Code widersprechen würden, werden explizit als Abweichung markiert.

---

## Kapitel 1: Produktdesign-Prinzipien

### 1.1 Klarheit über Ästhetik

**Prinzip:** Jede visuelle Entscheidung muss in erster Linie Klarheit erzeugen, nicht Schönheit.

**Konkret im UI:**
- Status-Farben sind nie dekorativ — sie tragen immer eine operationale Bedeutung
- Informationshierarchie durch Typografie-Gewicht und -Grösse, nicht durch Farbe allein
- Kein "leeres Design" als Dekoration — leere Flächen haben immer einen funktionalen Grund
- Primäraktion ist immer eindeutig: eine blaue CTA-Schaltfläche pro Seitenbereich

### 1.2 Statusführung als Kernprinzip

**Prinzip:** Der aktuelle Zustand einer Fahrt muss auf einen Blick erkennbar sein, ohne Interaktion.

**Konkret im UI:**
- Farbcodierter Left-Border auf jeder Fahrt-Zeile und -Karte (bereits implementiert)
- Status-Badge mit Farbpunkt + deutschem Label in jeder Ansicht (bereits implementiert: `RideStatusBadge`)
- Handlungsbedarf-Karten im Dashboard mit rotem Left-Border, sofort sichtbar
- Kein versteckter Status hinter Hover oder Click
- Dashboard zeigt Ungeplant-Zähler in Rot, sofortiger Handlungsdruck erkennbar

### 1.3 Informationsdichte abgestuft nach Kontext

**Prinzip:** Disponent braucht Dichte, Fahrer braucht Weiträumigkeit.

**Konkret im UI:**
- Disponent (Desktop): Tabellen mit 7 Spalten, kompakte Karten, dichte Filter
- Disponent (Desktop): Wochenkalender-Grid mit kompakten Fahrt-Pills
- Fahrer (Mobile): Nur eine Fahrt im Fokus, `text-3xl` für Uhrzeit, `h-12` Mindest-Touchfläche
- Fahrer (Mobile): Maximal 2 Aktionsbuttons gleichzeitig sichtbar, volle Breite

### 1.4 Progressive Disclosure

**Prinzip:** Zeige zuerst das Wichtigste. Details nur auf Anfrage.

**Konkret im UI:**
- Dashboard: Kennzahlen-Karten oben, Detaillisten unten, Karte ganz unten
- Fahrtenliste: Zeile zeigt Zeit, Patient, Ziel, Status. Details über Link oder Sheet.
- Fahrtformular: Pflichtfelder zuerst, optionale Felder (Notizen, Wiederholung) darunter oder in eigenem Bereich
- Disponent sieht Fahrt-Detail in einem Side-Sheet, ohne Seitennavigation zu verlassen

### 1.5 Fehlervermeidung über Fehlerbehandlung

**Prinzip:** Ungültige Zustände sollen gar nicht erst erreichbar sein.

**Konkret im UI:**
- Status-Übergänge im Dropdown nur valide Optionen zeigen (bereits implementiert via `getValidTransitionsForRole`)
- "Stornieren"-Button nur in Bestätigungs-Dialog erreichbar (AlertDialog-Pattern)
- Formular-Submit-Button deaktiviert, solange Pflichtfelder fehlen
- Doppelklick-Schutz via `useTransition` (bereits implementiert)
- Destruktive Aktionen (Ablehnen, Stornieren) visuell von primären Aktionen getrennt, immer Outline-Variant mit rotem Rand

### 1.6 Konsistenz als Vertrauen

**Prinzip:** Gleiche Farben bedeuten immer dasselbe. Gleiche Interaktionen verhalten sich immer gleich.

**Konkret im UI:**
- Rot bedeutet immer: Handlungsbedarf oder Fehler
- Grün bedeutet immer: abgeschlossen, erfolgreich, bestätigt
- Amber bedeutet immer: ausstehend, warten auf Bestätigung
- `Left-Border-4` auf Karten immer = Status-Indikator
- `DropdownMenu` immer für Kontextaktionen auf Tabellenzeilen

### 1.7 Geschwindigkeit der Interaktion

**Prinzip:** Jeder unnötige Klick kostet Zeit. Im Betriebsalltag summiert sich das.

**Konkret im UI:**
- Datum-Navigation in Fahrten- und Dispositionsansicht mit Prev/Next-Pfeilen, kein Datepicker-Overhead
- Schnell-Filter als Click-Chips, kein Dropdown-Overhead
- Fahrt-Statusänderung direkt im Kontextmenü, kein eigener Screen nötig
- Fahrer zuweisen: Inline-Select in der Disposition, kein Formularseitenaufruf
- "Neue Fahrt"-Button im PageHeader jeder relevanten Seite sichtbar

### 1.8 Operationale Verlässlichkeit

**Prinzip:** Das System muss auch bei Stress, wenig Schlaf und Zeitdruck bedienbar sein.

**Konkret im UI:**
- Keine dynamischen Layouts, die sich unter dem Cursor verschieben
- Loading-Skeleton statt blanker Flächen, damit der Nutzer weiss, dass etwas lädt
- Toast-Feedback nach jeder Aktion (Erfolg/Fehler), sichtbar in der Ecke
- Fehler-States mit konkreter Beschreibung, nicht nur "Fehler aufgetreten"
- Tastaturnavigation für alle Formulare und Tabellen (WCAG AA Minimum)

### 1.9 Seniorengerechte Bedienung

**Prinzip:** Viele Fahrer und Patienten sind älter. Das UI muss auch mit grosser Schrift und unsicherer Motorik bedienbar sein.

**Konkret im UI:**
- Mindest-Touch-Ziel: 44×44px (mobile), bevorzugt 48px+ für Hauptaktionen
- Body-Text mindestens `text-sm` (14px), bevorzugt `text-base` (16px) für Inhalte
- Farbkontrast mindestens 4.5:1 (WCAG AA) für alle Text/Hintergrund-Kombinationen
- Icons immer mit Text-Label kombiniert — nie Icon allein für Aktionen
- Fehlermeldungen in Prosa, nicht als technischer Code

---

## Kapitel 2: Rollenbasierte Informationsarchitektur

### 2.1 Rollen-Übersicht

| Rolle | Gerät | Kernaufgabe | Navigationsbedarf |
|-------|-------|-------------|-------------------|
| **Admin** | Desktop | Vollzugriff + Systemkonfiguration | Alle Bereiche |
| **Operator / Disponent** | Desktop | Fahrten planen, Fahrer zuweisen, Betrieb überwachen | Betriebsbereiche |
| **Fahrer** | Mobile | Eigene Fahrten abrufen, Status setzen | Nur "Meine Fahrten" + Verfügbarkeit |

### 2.2 Ist-Zustand: Navigation

Die aktuelle Navigation hat für Admin/Operator **9 Items** in der horizontalen Headerleiste:

```
Dashboard | Fahrten | Disposition | Fahrtserien | Fahrer | Ziele | Patienten | Verrechnung | [Benutzer] | [Einstellungen]
```

**Problem:** Bei kleineren Desktops (1280px) wird die Leiste zu eng. Die Navigation scrollt horizontal (`overflow-x-auto`), was nicht intuitiv ist.

### 2.3 Empfehlung: Zweigeteilte Navigation

**Für den Betriebsbereich (Disponent/Admin):**

Gruppierung in zwei logische Cluster:

**Primär-Navigation (immer sichtbar, Kernanwendungsfälle):**
- Dashboard
- Fahrten
- Disposition
- Fahrer

**Sekundär-Navigation (erreichbar, aber weniger frequent):**
- Fahrtserien
- Patienten
- Ziele
- Verrechnung
- Benutzer *(nur Admin)*
- Einstellungen *(nur Admin)*

**Umsetzungsoptionen (nach Aufwand sortiert):**

Option A — Horizontale Navigation mit Trennlinie (geringer Aufwand, passt zum Ist-Zustand):
```
[Dashboard] [Fahrten] [Disposition] [Fahrer]  |  [Fahrtserien] [Patienten] [Ziele] [Verrechnung]  |  [Settings-Icon]
```

Option B — Vertikal klappbare Sidebar (mittlerer Aufwand, skaliert besser):
- Linke Sidebar, 240px, collapsible zu 60px Icon-Only
- Sektionen: "Betrieb", "Stammdaten", "Administration"

Option C — Top-Nav + Kontextmenü für Stammdaten (aktuell nächste an Ist-Zustand):
- Primär-Items inline
- "Mehr"-Dropdown für Stammdaten-Bereich

**Empfehlung:** Option A als kurzfristige Verbesserung, Option B als langfristige skalierbare Lösung.

### 2.4 Fahrer-Navigation

Fahrer sehen nur:
```
[Meine Fahrten] [Verfügbarkeit]
```

Beide Items passen problemlos in den Header. Die aktuelle Implementierung ist korrekt.

### 2.5 Informationsarchitektur — Seiten-Hierarchie

```
/                           → Dashboard (Admin/Operator)
/rides                      → Fahrten Wochenansicht (Standard)
/rides?date=YYYY-MM-DD      → Fahrten Tagesansicht
/rides/new                  → Neue Fahrt erfassen
/rides/[id]                 → Fahrt-Detail
/rides/[id]/edit            → Fahrt bearbeiten
/dispatch                   → Disposition Wochenansicht
/dispatch?date=YYYY-MM-DD   → Disposition Tagesansicht (DispatchBoard)
/ride-series                → Fahrtserien-Übersicht
/ride-series/new            → Neue Fahrserie
/drivers                    → Fahrerübersicht
/drivers/new                → Neuer Fahrer
/drivers/[id]               → Fahrer-Detail
/drivers/[id]/edit          → Fahrer bearbeiten
/drivers/[id]/availability  → Verfügbarkeit verwalten
/patients                   → Patientenübersicht (Card-Grid)
/patients/new               → Neuer Patient
/patients/[id]/edit         → Patient bearbeiten
/destinations               → Ziele-Übersicht (Card-Grid)
/destinations/new           → Neues Ziel
/destinations/[id]/edit     → Ziel bearbeiten
/billing                    → Verrechnung
/users                      → Benutzerverwaltung (Admin)
/settings/zones             → Einstellungen (Admin)

/my/rides                   → Meine Fahrten (Fahrer)
/my/availability            → Meine Verfügbarkeit (Fahrer)
```

---

## Kapitel 3: Haupt-Userflows

### Flow 1: Neue Fahrt erfassen (Disponent, Desktop)

**Trigger:** Anruf eines Patienten oder Arztpraxis. Disponent muss sofort handeln.

```
1. Dashboard → "Handlungsbedarf"-Sektion zeigt ggf. ungeplante Fahrten
2. Klick auf "+ Neue Fahrt" im PageHeader (von jeder Seite erreichbar)
3. Formular öffnet sich auf /rides/new
4. Patient auswählen (Dropdown mit Suche) oder "+" für Schnellanlage (Inline-Dialog)
5. Datum auswählen (Datepicker, vorausgefüllt mit heute)
6. Abholzeit eingeben (Zeitfeld, 5-Min-Schritte empfohlen)
7. Ziel auswählen (Dropdown mit Suche) oder "+" für Schnellanlage (Inline-Dialog)
8. Richtung wählen: Hinfahrt / Rückfahrt / Hin & Rück
9. Bei "Hin & Rück": Termin-Uhrzeit eingeben → Rückfahrtzeit wird automatisch berechnet
10. Fahrzeugtyp prüfen (aus Patientendaten vorgeschlagen, falls gepflegt)
11. Route berechnen lassen (Button "Route berechnen") → Karte + Distanz/Dauer erscheinen
12. Optional: Fahrer zuweisen (Dropdown, gefiltert nach verfügbaren Fahrern)
13. Optional: Notizen eingeben
14. "Fahrt speichern" klicken → Toast "Fahrt erfasst", Weiterleitung zu /rides/[id]
```

**Fehlerfälle:**
- Patient nicht vorhanden → Inline-Dialog, kein Seitenwechsel
- Ziel nicht vorhanden → Inline-Dialog, kein Seitenwechsel
- Kein Fahrer verfügbar → Fahrt wird als "Ungeplant" gespeichert, erscheint im Dashboard-Handlungsbedarf

### Flow 2: Fahrer zuweisen (Disponent, Disposition Tagesansicht)

```
1. Dispatch-Seite → Tag auswählen (?date=YYYY-MM-DD)
2. Ungeplante Fahrten erscheinen oben mit rotem Left-Border
3. Klick auf Fahrt-Zeile öffnet Inline-Assign-Bereich (kein Seitenwechsel)
4. Fahrer-Dropdown zeigt verfügbare Fahrer mit Zeitslot-Indikator
5. Fahrer auswählen → Status springt auf "Geplant", Left-Border wird blau
6. E-Mail-Benachrichtigung wird ausgelöst (Acceptance-Flow)
7. Falls kein Acceptance-Flow: Fahrt gilt als direkt bestätigt
8. Acceptance-Queue zeigt ausstehende Annahmen/Ablehnungen oben auf der Seite
```

### Flow 3: Statusführung am Fahrtag (Fahrer, Mobile)

```
1. Fahrer öffnet App → Weiterleitung zu /my/rides
2. Tagesdatum mit Fahrten wird angezeigt, aktuellste Fahrt oben
3. Pending Assignments (offene Zuweisungen) erscheinen ganz oben mit Annehmen/Ablehnen
4. Bestätigte Fahrt zeigt "Fahrt starten"-Button (h-12, volle Breite)
5. Klick "Fahrt starten" → Status: "Unterwegs" (in_progress)
6. Neue Aktion erscheint: "Patient abgeholt" → Status: "Abgeholt" (picked_up)
7. Neue Aktion erscheint: "Angekommen" → Status: "Angekommen" (arrived)
8. Neue Aktion erscheint: "Abgeschlossen" → Status: "Erledigt" (completed)
9. Parallele Option: "Nicht erschienen" → AlertDialog → Bestätigung → Status: "Kein Erscheinen"
```

### Flow 4: Kurzfristige Änderung (Disponent)

```
1. Fahrt im DispatchBoard aufrufen
2. Kontext-Dropdown auf der Zeile → "Bearbeiten"
3. Fahrt-Formular öffnet sich (vorausgefüllte Daten)
4. Änderungen vornehmen (Fahrer tauschen, Zeit anpassen)
5. Speichern → Toast, Rückkehr zur Ausgangsliste
Alternativ für reine Fahrerwechsel:
3. Kontext-Dropdown → neuen Status setzen
4. In Disposition: Fahrer-Dropdown direkt in der Tabellenzeile wechseln
```

### Flow 5: Fahrt stornieren (Disponent)

```
1. Fahrt-Detail aufrufen (/rides/[id])
2. "Stornieren"-Button (Destructive, sichtbar nur für Admin/Operator)
3. AlertDialog: "Fahrt wirklich stornieren? Diese Aktion kann nicht rückgängig gemacht werden."
4. Bestätigen → Status: "Storniert", Left-Border: grau, Opacity: 60%
5. Toast "Fahrt wurde storniert"
```

### Flow 6: Wochenplanung (Disponent)

```
1. /dispatch oder /rides → Standard-Ansicht ist Wochenkalender
2. Wochennavigation: Vorherige / Aktuelle / Nächste Woche
3. Woche auf einen Blick: 7 Spalten, kompakte Fahrt-Pills pro Tag
4. Klick auf Tageskopf → Wechsel zur Tagesansicht
5. Klick auf Fahrt-Pill → Sprung zu /rides/[id]
6. In Dispatch-Wochenansicht: Rot-Indikator bei unzugewiesenen Fahrten pro Tag
```

---

## Kapitel 4: Screen-Konzept Disponent

### 4.1 Dashboard (`/`)

**Zweck:** Sofortige Lagebewusstsein am Morgen und während des Tages. Was ist heute los? Was braucht sofortige Aufmerksamkeit?

**Inhalte (von oben nach unten, nach Priorität):**
1. Tagesstatistiken — Gesamt, Ungeplant (rot wenn >0), Aktiv, Abgeschlossen
2. Wochenstatistiken — Diese Woche, Nächste Woche, Letzter Monat, Fahrer heute
3. Idle-Fahrer-Banner — Amber, nur wenn verfügbare Fahrer ohne Fahrt vorhanden
4. Handlungsbedarf — Ungeplante + abgelehnte Fahrten (links), Ausstehende Bestätigungen (rechts)
5. Nächste Fahrten — Die nächsten 5 ab jetzt
6. Offene Fahrten (datumübergreifend) — Rot
7. Fahrten ohne Fahrer — Orange
8. Fahrer-Ranking — Gamification, sekundär
9. Standort-Karte — "Heutige Standorte" (unten, lazy-loaded)

**Verbesserungsempfehlung gegenüber Ist-Zustand:**

Die aktuelle Implementierung ist bereits sehr gut. Folgende Optimierungen werden empfohlen:

- "Handlungsbedarf" und "Nächste Fahrten" sollten im gleichen visuellen Gewicht erscheinen, aber Handlungsbedarf stärker priorisiert — ggf. Handlungsbedarf-Bereich oben/links, Nächste Fahrten als sekundäre Info
- Idle-Fahrer-Banner kann direkt zur `/dispatch?date=heute`-Seite verlinken, nicht nur zum Fahrerprofil
- "Offene Fahrten" und "Fahrten ohne Fahrer" könnten zu einem "Pendenzbereich" zusammengeführt werden mit Tab-Umschaltung (spart vertikalen Platz)

**Layout (Desktop, 1280px):**
```
┌──────────────────────────────────────────────────────────┐
│  [Stat] [Stat] [Stat] [Stat]                             │  Row 1: Tageskennzahlen
├──────────────────────────────────────────────────────────┤
│  [Diese Woche] [Nächste W.] [Letzt. Monat] [Fahrer]     │  Row 2: Periodenkennzahlen
├──────────────────────────────────────────────────────────┤
│  [!] Idle-Fahrer: Müller, Schmidt                        │  Row 3: Amber Banner (conditional)
├─────────────────────────┬────────────────────────────────┤
│  Handlungsbedarf        │  Nächste Fahrten               │  Row 4: 2-Col
│  [Fahrt ROT]            │  [Fahrt]                       │
│  [Fahrt ROT]            │  [Fahrt]                       │
├─────────────────────────┼────────────────────────────────┤
│  Offene Fahrten         │  Fahrten ohne Fahrer           │  Row 5: 2-Col
├──────────────────────────────────────────────────────────┤
│  Fahrer-Ranking [Tabelle]                                │  Row 6: Full-width
├──────────────────────────────────────────────────────────┤
│  Heutige Standorte [Karte]                               │  Row 7: Full-width, lazy
└──────────────────────────────────────────────────────────┘
```

**Aktionen:** Klick auf jede Fahrt → `/rides/[id]`. Klick auf Fahrer → `/drivers/[id]`.

### 4.2 Fahrtenliste — Wochenansicht (`/rides`)

**Zweck:** Überblick über die gesamte Woche. Planungsgrundlage.

**Inhalte:**
- WeekNav-Leiste: Vorherige Woche / Woche YYYY-MM-DD bis YYYY-MM-DD / Nächste Woche / Heute
- 7-Spalten-Grid (Mo–So), jede Spalte = ein Tag
- Kompakte Ride-Pills in jeder Spalte: `[Zeit] [Patienten-Initialen] [Status-Dot]`
- Überladene Tage zeigen "+ N weitere"-Link
- Dringlichkeits-Indikator auf Tagesheader: roter Punkt wenn ungeplante Fahrten an dem Tag

**Layout (Desktop):**
```
┌──────────────────────────────────────────────────────────┐
│  PageHeader: "Fahrten" | Wochenübersicht | [+ Neue Fahrt]│
├──────────────────────────────────────────────────────────┤
│  [◀ Vorherige] [16.–22. März 2026] [Nächste ▶] [Heute]  │
├────────┬────────┬────────┬────────┬────────┬──────┬──────┤
│ Mo 16. │ Di 17. │ Mi 18. │ Do 19. │ Fr 20. │ Sa 21│ So 22│
│   ●    │        │  [!]   │        │        │      │      │
├────────┼────────┼────────┼────────┼────────┼──────┼──────┤
│ 07:15  │ 08:00  │ 06:45  │ 09:00  │        │      │      │
│ MH ●   │ SB ●   │ GM ●   │ KL ●   │        │      │      │
│ 09:30  │        │ 14:00  │        │        │      │      │
│ TM ●   │        │ FM ●   │        │        │      │      │
│        │        │+ 3 weit│        │        │      │      │
└────────┴────────┴────────┴────────┴────────┴──────┴──────┘
```

**Tagesansicht (nach Klick auf Tageskopf oder `/rides?date=...`):**
- Tagesnavigation Prev/Next/Heute + Link zurück zur Wochenansicht
- Karte oben (RidesDayMap, 280px–400px)
- RidesTable darunter mit Suche + Status-Filter

### 4.3 Fahrt-Detail (`/rides/[id]`)

**Zweck:** Alle Informationen zu einer spezifischen Fahrt. Direkt navigierbar, verlinkbar.

**Inhalte:**
- PageHeader mit Zurück-Link, Fahrt-ID, Edit-Button
- Hero-Bereich: Zeit gross, Patient, Ziel, Status-Badge, Richtung
- Info-Grid: Fahrer, Datum, Fahrzeugtyp, Termin-Zeit (falls vorhanden), verknüpfte Hinfahrt
- Routeninfo: Distanz, Dauer, Route-Map (embedded)
- Notizen (falls vorhanden): amber-Hintergrundfläche
- Status-Timeline: Visueller Verlauf der Statusänderungen mit Zeitstempeln
- Kommunikations-Log: E-Mail-Sendungen, Acceptance-Einträge
- Aktionen: Bearbeiten, Status ändern, Stornieren (destructive, AlertDialog)

### 4.4 Neue Fahrt erfassen (`/rides/new`)

**Zweck:** Schnelle und fehlerfreie Erfassung einer neuen Fahrt.

**Layout (max-w-5xl, zweikolumnig auf Desktop):**
```
┌────────────────────────────────────────────────────────┐
│ PageHeader: "Neue Fahrt erfassen"                      │
├────────────────────────┬───────────────────────────────┤
│  FORMULAR              │  VORSCHAU                     │
│                        │                               │
│  Patient [▼][+]        │  RideTimeline                 │
│  Datum   [📅]          │  (Zeitstrahl der geplanten    │
│  Abholzeit [00:00]     │   Fahrt: Abholung → Ankunft   │
│  Ziel    [▼][+]        │   → Rückfahrt falls geplant)  │
│  Richtung [○ Hin       │                               │
│            ○ Rück      │  RouteMap                     │
│            ○ H+R]      │  (nach Route-Berechnung)      │
│  Termin  [00:00]       │                               │
│  Fahrzeug[▼]           │  Distanz: X km                │
│  Fahrer  [▼]           │  Dauer:   X Min               │
│  Notizen [textarea]    │                               │
│  Wiederholung [toggle] │                               │
│                        │                               │
│  [Route berechnen]     │                               │
│                        │                               │
│  [Speichern]           │                               │
└────────────────────────┴───────────────────────────────┘
```

**Formular-Verhalten:**
- "Rückfahrt"-Zeitfeld erscheint nur wenn Richtung "H+R" oder "Rückfahrt" gewählt
- Termin-Zeitfeld erscheint bei "H+R": Rückfahrzeit wird automatisch berechnet (+ Puffer)
- Wiederholungs-Toggle öffnet einen Konfigurationsbereich (Fahrtserien)
- Inline-Dialogs für Patient/Ziel erstellen, ohne Seite zu verlassen

### 4.5 Disposition — Tagesansicht (`/dispatch?date=...`)

**Zweck:** Zentrale Arbeitsfläche für den Disponenten. Fahrten zuweisen, Konflikte lösen.

**Layout (Desktop, kein max-w-7xl für diesen Screen empfohlen, volle Breite nutzen):**
```
┌──────────────────────────────────────────────────────────────────┐
│  PageHeader: "Disposition" | Tagesübersicht | [◀ Tag ▶ Heute]   │
├──────────────────────────────────────────────────────────────────┤
│  [Acceptance Queue — falls Einträge vorhanden]                   │
├──────────────────────────────────┬───────────────────────────────┤
│  FAHRTENLISTE (flex-1)           │  FAHRER-SIDEBAR (320px)       │
│                                  │                               │
│  Status-Filter-Chips:            │  Verfügbare Fahrer heute      │
│  [Alle] [Ungeplant] [Geplant]    │  ┌────────────────────────┐  │
│  [Bestätigt] [Aktiv]             │  │ Müller Hans            │  │
│                                  │  │ PKW • 08:00–18:00      │  │
│  ┌──────────────────────────┐    │  │ [3 Fahrten]            │  │
│  │ 🔴 07:15 Huber, Maria    │    │  └────────────────────────┘  │
│  │    St. Gallen Kantonsspital│  │  ┌────────────────────────┐  │
│  │    [Fahrer zuweisen ▼]    │  │  │ Schmidt Beat           │  │
│  └──────────────────────────┘    │  │ Rollstuhl • 10:00–16:00│  │
│  ┌──────────────────────────┐    │  │ [1 Fahrt]              │  │
│  │ 🔵 08:00 Meier, Josef    │    │  └────────────────────────┘  │
│  │    Spital Grabs           │    │                               │
│  │    Fahrer: Müller, Hans   │    │  Abwesende Fahrer            │
│  └──────────────────────────┘    │  ┌────────────────────────┐  │
│                                  │  │ Keller Peter (inaktiv) │  │
│  [Status-Filter-Chips]           │  └────────────────────────┘  │
└──────────────────────────────────┴───────────────────────────────┘
```

**Empfehlung Abweichung vom Ist-Zustand:** Die Tagesansicht sollte `max-w-none` oder `max-w-screen-2xl` verwenden statt dem üblichen `max-w-7xl`, um die volle Bildschirmbreite für die zweigeteilte Disposition zu nutzen. Aktuell ist dies nicht der Fall.

### 4.6 Disposition — Wochenansicht (`/dispatch`)

Wie Fahrtenliste-Wochenansicht, aber mit Dispatch-spezifischen Infos:
- Jede Fahrt-Pill zeigt Fahrer-Initialen statt nur Patienten-Initialen
- Rot = kein Fahrer zugewiesen, Grün = Fahrer zugewiesen
- Klick auf Tageskopf → Tages-Disposition (nicht Fahrtenliste)

### 4.7 Fahrerübersicht (`/drivers`)

**Zweck:** Stammdaten der Fahrer verwalten.

**Aktueller Ist-Zustand:** `DriversTable` — Standard shadcn Table-Komponente.

**Empfehlung:** Gleiche Card-Grid-Ansicht wie Patienten/Ziele, da Fahrer ähnliche Stammdatencharakteristik haben. Karte zeigt: Name, Fahrzeugtyp-Badge, Aktiv/Inaktiv, Anzahl Fahrten diesen Monat.

**Fahrer-Detail (`/drivers/[id]`):**
- Persönliche Daten: Name, Kontakt, Fahrzeugtyp
- Verfügbarkeitsübersicht: Wochenplan als visuelle Grid (Mo–So, Zeitslots farblich markiert)
- Fahrtenhistorie: Letzte 10 Fahrten, Statusverteilung
- Link zu `/drivers/[id]/availability`

### 4.8 Patientenübersicht (`/patients`)

**Zweck:** Stammdaten der Patienten verwalten, schnell finden.

**Ist-Zustand:** Card-Grid bereits implementiert (`patient-card.tsx`, `patient-detail-sheet.tsx`).

**Verbesserungsempfehlungen:**
- Schnellsuche über Name und Wohnort prominent oben
- Filter nach Beeinträchtigungstyp (Rollstuhl, Liegend) als Chips
- In der Detail-Sheet direkter Link "Fahrt für diesen Patienten erfassen" → `/rides/new?patient_id=XXX`

### 4.9 Ziele-Übersicht (`/destinations`)

**Ist-Zustand:** Card-Grid bereits implementiert (`destination-card.tsx`, `destination-detail-sheet.tsx`).

**Verbesserungsempfehlungen:**
- Filter nach Einrichtungstyp (Krankenhaus, Arzt, Therapie) als Chips oben
- In der Detail-Sheet: Karte mit Pin des Zielorts
- Direkter Link: "Fahrt zu diesem Ziel erfassen" → `/rides/new?destination_id=XXX`

### 4.10 Kartenansicht / Live-Disposition

Aktuell gibt es zwei Karten-Kontexte:
1. **Dashboard-Karte** (`DashboardMap`): Google Maps Static API, Standorte der heutigen Ziele/Patienten
2. **Tagesmap Fahrten** (`RidesDayMap`): Eingebettete Karte für eine Tagesübersicht

**Empfehlung für zukünftige Entwicklung — Live-Karte:**
- Eigener Screen oder eingebettete Sektion in Disposition
- Fahrerpositionen als Punkte auf der Karte (requires Echtzeit-Daten)
- Farbkodierte Pins nach Fahrt-Status
- Klick auf Pin öffnet Popup mit Fahrt-Info und Link zur Detail-Seite

### 4.11 Warnungen und Konflikte

**Wann Warnungen zeigen:**
- Ungeplante Fahrten (immer rot im Dashboard + Handlungsbedarf)
- Fahrt in der Vergangenheit ohne Abschluss → amber Warning in Fahrt-Detail
- Zeitkonflikt: Zwei Fahrten demselben Fahrer zur gleichen Zeit → Warnsymbol in Disposition
- Ablauf-Warnung: Acceptance-Token läuft in 24h ab → Banner in Acceptance-Queue

**UI-Pattern für Warnungen:**
- Inline-Warning: `border-l-4 border-l-amber-400 bg-amber-50/40` mit `AlertTriangle`-Icon
- Kritische Warnung (Aktion erforderlich): `border-l-4 border-l-red-500 bg-red-50/40` mit `AlertCircle`-Icon
- Banner (systemweit): Unter dem Header, `bg-red-600 text-white` mit Dismiss-Option

---

## Kapitel 5: Screen-Konzept Fahrer

### 5.1 Design-Grundsatz für Fahrer

Fahrer nutzen die App auf dem Smartphone, oft in Bewegung, mit Handschuhen oder bei schwachem Licht. Das UI muss:
- Touchziele mindestens 48px Höhe
- Schriftgrösse mindestens 16px für Inhalte, 24px+ für Kerninfos
- Maximale Informationsdichte: **eine primäre Aktion pro Screen-Abschnitt**
- Navigation: zurück-Geste oder expliziter Zurück-Button, kein versteckter Zustand
- Farbe: Status-Farben sind durch Form und Grösse doppelt kodiert, nicht nur durch Farbe

### 5.2 Meine Fahrten (`/my/rides`)

**Zweck:** Fahrer sieht seine Fahrten für den heutigen Tag, kann Status setzen.

**Ist-Zustand:** `MyRidesList` mit Card-basiertem Layout — bereits sehr gut umgesetzt.

**Aktuell vorhanden:**
- Abholzeit gross (`text-3xl font-bold`)
- Status-Badge oben rechts
- Patient + Ziel + Richtung als Text
- Notizen in Amber-Box
- Aktionsbuttons `h-12 w-full` (gross genug)
- `border-l-[5px]` Status-Left-Border

**Empfehlungen zur Ergänzung:**

Oben auf der Seite: Tagesanzeige mit Fahrtenanzahl und Fortschrittsbalken:
```
┌─────────────────────────────────┐
│ Montag, 16. März 2026           │
│ ■■■■■□□□□□  3 von 7 erledigt    │
└─────────────────────────────────┘
```

Fahrt-Karte mit zusätzlichem Navigations-Link:
```
┌─────────────────────────────────┐
│ 07:15                  [Geplant]│
├─────────────────────────────────┤
│ Huber, Maria                    │
│ Kantonsspital St. Gallen         │
│ Hinfahrt                        │
├─────────────────────────────────┤
│ [Notiz: Rollstuhl nötig]        │
├─────────────────────────────────┤
│ [Navigation starten ↗]          │  ← Google Maps Deep-Link
├─────────────────────────────────┤
│ [Fahrt starten]  (h-12, blau)  │  ← Primäre Aktion
│ [Ablehnen]       (h-12, outline)│  ← Sekundäre Aktion
└─────────────────────────────────┘
```

### 5.3 Offene Zuweisungen (innerhalb `/my/rides`)

**Ist-Zustand:** `PendingAssignments`-Komponente, bereits implementiert und korrekt gestylt.

- `text-3xl` Zeitanzeige
- Annehmen (grün, `bg-green-600`) + Ablehnen (rot, outline) nebeneinander
- `border-l-[5px] border-l-amber-400`

**Keine Änderungen notwendig.** Das Pattern ist bereits optimal.

### 5.4 Verfügbarkeit (`/my/availability`)

**Zweck:** Fahrer trägt seine Verfügbarkeit für die Woche ein.

**Layout (Mobile):**
- Wochenansicht als vertikal gescrollte Liste
- Jeder Tag: Toggle "Verfügbar" + Zeitslot-Picker (wenn aktiv)
- Zeitslots als vordefinierten Buttons (08:00–10:00, 10:00–12:00, etc.)
- Spezifische Datumsausnahmen separat

### 5.5 Statusübergänge — Aktionslogik

Folgende Statusübergänge sind für Fahrer im UI abgebildet:

| Von-Status | Verfügbare Aktionen | Button-Farbe |
|-----------|---------------------|-------------|
| confirmed | Fahrt starten | Primär (blau) |
| confirmed | Ablehnen | Outline rot |
| in_progress | Patient abgeholt | Primär |
| in_progress | Problem melden | Outline amber |
| picked_up | Angekommen | Primär |
| arrived | Abgeschlossen | Primär (grün) |
| arrived | Nicht erschienen | Outline rot |

### 5.6 Navigation starten (Deep-Link)

Für jede Fahrt mit bekannter Adresse: Deep-Link zu Google Maps Navigation.

```tsx
// Pattern:
const mapsUrl = `https://maps.google.com/maps?q=${encodeURIComponent(destAddress)}`
// oder mit Koordinaten:
const mapsUrl = `https://maps.google.com/maps?daddr=${lat},${lng}`
```

Dieser Link öffnet die native Karten-App auf iOS und Android. Button-Label: "Navigation starten" mit `Navigation`-Icon (Lucide: `Navigation`).

---

## Kapitel 6: Google Maps Integration

### 6.1 Aktuelle Implementierung

Das Projekt verwendet aktuell **zwei Map-Kontexte**:

| Komponente | Typ | Zweck |
|------------|-----|-------|
| `LocationMap` | Google Maps Embed API (iframe) | Einzelner Standort-Pin |
| `RouteMap` | Google Maps Embed API (iframe) | Route A→B |
| `RidesDayMap` | Eigene Implementierung | Tagesübersicht Fahrten |
| `DashboardMap` | Google Maps Static API (img) | Multi-Pin-Übersicht |
| `RideDetailMap` | Eigene Implementierung | Fahrt-Route auf Detail-Seite |

### 6.2 Karte pro Screen

**Dashboard (`/`):**
- Google Maps Static API: Multi-Pin mit Zielen (blau) und Patienten-Adressen (rot)
- 640×400px bei 2x Auflösung
- Filter: Alle / Nur Ziele / Nur Patienten
- Keine Interaktivität (statisches Bild)

**Fahrtenliste Tagesansicht (`/rides?date=...`):**
- RidesDayMap: Alle Abholorte + Ziele des Tages auf einer Karte
- Farbcodierung nach Fahrt-Status
- Höhe: 280–400px

**Fahrt-Formular (`/rides/new`):**
- RouteMap: Erscheint nach "Route berechnen"
- Zeigt Route von Abholadresse zu Zieladresse
- Distanz und Dauer als Text daneben

**Fahrt-Detail (`/rides/[id]`):**
- RideDetailMap oder RouteMap: Route der spezifischen Fahrt
- Distanz/Dauer als Metadaten-Block

**Disposition Tagesansicht (`/dispatch?date=...`):**
- Karte im rechten Panel oder als ausklappbarer Tab
- Fahrerpositionen (wenn Echtzeit-Daten verfügbar)
- Fahrtrouten als Overlay

**Fahrer-Ansicht (`/my/rides`):**
- Keine Karte eingebettet (zu klein, ablenkt vom Workflow)
- Stattdessen: "Navigation starten"-Button als Deep-Link zu Google Maps

### 6.3 Kartenkonventionen

**Pin-Farben (Google Maps Static API):**
- Abholadresse (Patient): `color:red` oder eigener Marker
- Zieladresse: `color:blue`
- Aktive Fahrt: `color:green`
- Abgeschlossene Fahrt: `color:gray`

**Iframe vs. Static API Entscheidung:**
- `RouteMap` (Formular, Detail): Embed API mit directions-Typ — interaktiv, zoombar
- `DashboardMap`: Static API — schneller, kein JS-Overhead, genug für Übersicht
- Live-Tracking (Zukunft): Google Maps JS API via `@vis.gl/react-google-maps`

### 6.4 Performance-Hinweise

- Static API-Karten werden als `<img>` eingebunden, nicht als iframe — kein Scrolljacking, kein iframe-Layout-Overhead
- Kartengrösse begrenzen: max 640×400px für Static API (innerhalb kostenlosem Tier bei niedrigem Volumen)
- Karten lazy-loaden via Next.js `<Suspense>` (bereits umgesetzt beim Dashboard)

---

## Kapitel 7: UI-Komponenten-System

### 7.1 Typografie-Hierarchie

| Ebene | Element | Tailwind-Klassen | Verwendung |
|-------|---------|-----------------|-----------|
| Page Title | H1 | `text-3xl font-bold tracking-tight text-slate-900` | Selten, nur Splash-Screens |
| Section Title | H2 | `text-2xl font-semibold tracking-tight text-slate-900` | Seiten-Titel (Dashboard, etc.) |
| Card Title | H3 | `text-base font-semibold leading-none tracking-tight text-slate-900` | Karten-Überschriften |
| Body | p | `text-sm text-foreground` (14px) | Standard-Fliesstext |
| Secondary | p | `text-sm text-muted-foreground` | Untertitel, Labels |
| Caption | span | `text-xs text-muted-foreground` | Hinweise, Zeitstempel |
| Label | label | `text-sm font-medium text-foreground` | Formular-Labels |
| Section Label | span | `text-xs font-semibold uppercase tracking-wide text-muted-foreground` | Sheet-Abschnitte |
| Numeric Hero | span | `text-3xl font-bold tabular-nums` | Tageszeit (Fahrer-Ansicht) |
| Numeric KPI | p | `text-3xl font-bold tabular-nums` | Dashboard-Kennzahlen |
| Numeric Dense | span | `text-sm font-medium tabular-nums` | Tabellen-Uhrzeiten |

**Regel:** `tabular-nums` immer bei Zahlen, die sich dynamisch ändern (Uhrzeiten, Zähler).

### 7.2 Farbsystem

**Primärpalette:**

| Token | CSS-Variable | Hex | Verwendung |
|-------|-------------|-----|-----------|
| `primary` | `--primary` | `hsl(211 96% 42%)` | CTA-Buttons, Links, aktiver Navbar-Eintrag |
| `secondary` | `--secondary` | `hsl(210 30% 94%)` | Sekundäre Buttons, Hintergründe |
| `muted` | `--muted` | `hsl(214 32% 95%)` | Tabellen-Hover, Hintergrundflächen |
| `accent` | `--accent` | `hsl(189 56% 92%)` | Hover-States auf Ghost-Elementen |
| `destructive` | `--destructive` | `hsl(0 84% 56%)` | Delete, Cancel-Buttons |
| `background` | `--background` | `hsl(213 45% 98%)` | Seitenhintergrund |

**Status-Farbpalette (vollständig, unveränderlich):**

| Status | CSS-Variable | Näherungswert | Bedeutung |
|--------|-------------|---------------|----------|
| `unplanned` | `--status-unplanned` | Grau | Noch nicht geplant |
| `planned` | `--status-planned` | Blau | Fahrer zugewiesen, nicht bestätigt |
| `confirmed` | `--status-confirmed` | Indigo | Vom Fahrer bestätigt |
| `in_progress` | `--status-in-progress` | Amber | Fahrer unterwegs zum Patienten |
| `picked_up` | `--status-picked-up` | Orange | Patient abgeholt |
| `arrived` | `--status-arrived` | Teal | Am Ziel angekommen |
| `completed` | `--status-completed` | Grün | Erfolgreich abgeschlossen |
| `cancelled` | `--status-cancelled` | Slate | Storniert |
| `rejected` | `--status-rejected` | Rot | Vom Fahrer abgelehnt |
| `no_show` | `--status-no-show` | Rose | Patient nicht erschienen |

**Weitere Farbtokens:**

| Verwendung | Tailwind | Bedeutung |
|-----------|---------|----------|
| Handlungsbedarf | `red-600`, `bg-red-50/40` | Sofort handeln |
| Warnung | `amber-500`, `bg-amber-50/40` | Aufmerksamkeit nötig |
| Erfolg/Bestätigt | `green-600`, `bg-green-50/40` | Positiver Zustand |
| Information | `blue-500`, `bg-blue-50/40` | Neutrale Info |

### 7.3 Button-System

| Variant | Tailwind (Ist-Zustand) | Verwendung |
|---------|----------------------|-----------|
| `default` | `bg-primary text-primary-foreground shadow-[...] hover:-translate-y-0.5` | Primäre CTA (Speichern, Neue Fahrt) |
| `destructive` | `bg-destructive text-destructive-foreground` | Löschen, Stornieren |
| `outline` | `border border-input bg-white/90` | Sekundäre Aktion, Ablehnen |
| `secondary` | `bg-secondary text-secondary-foreground` | Dritte Priorität |
| `ghost` | `hover:bg-accent/70` | Kontextlose Aktionen, Navigation |
| `link` | `text-primary underline-offset-4` | Inline-Links, Details |

**Grössen:**

| Size | Höhe | Verwendung |
|------|------|-----------|
| `sm` | `h-9` (36px) | Kompakte Tabellen-Aktionen |
| `default` | `h-10` (40px) | Standard-Formularbuttons |
| `lg` | `h-11` (44px) | Wichtige CTAs, Fahrer-Primäraktionen |
| — (custom) | `h-12` (48px) | Fahrer-Hauptaktionen (bereits im Code) |

**Mobile-Regel:** Alle Buttons in der Fahrer-App mindestens `h-12 w-full`.

### 7.4 Karten (Cards)

**Ist-Zustand:** `glass-panel` = `border border-white/70 bg-white/80 shadow-xl shadow-slate-900/5 backdrop-blur`

Karten-Varianten:

| Variant | Klassen-Ergänzung | Verwendung |
|---------|------------------|-----------|
| Standard | `glass-panel rounded-2xl` | Alle Standard-Karten |
| Warning | `+ border-amber-200 bg-amber-50/40` | Warnhinweise |
| Critical | `+ border-red-200 bg-red-50/40` | Handlungsbedarf |
| Success | `+ border-green-200 bg-green-50/40` | Bestätigungen |
| With Left Border | `+ border-l-[5px]` + Status-Farbe | Fahrt-Karten |
| Inactive | `+ opacity-60` | Deaktivierte Einträge |

### 7.5 Statusbadge (`RideStatusBadge`)

**Ist-Zustand:** Bereits implementiert in `src/components/shared/ride-status-badge.tsx`.

```
[●  Geplant]
```

Anatomie: Farbpunkt + Deutsches Label, abgerundetes Rectangle-Badge.

**Erweiterungsempfehlung:** Größen-Variante für kompakte Ansichten:
- `size="sm"`: `text-[10px] px-1.5 py-0.5` für Fahrt-Pills im Wochenkalender

### 7.6 Statusfarben-Referenz für Left-Borders (bereits implementiert)

```css
.ride-row-border-unplanned  { @apply border-l-4 border-l-gray-400; }
.ride-row-border-planned    { @apply border-l-4 border-l-blue-400; }
.ride-row-border-confirmed  { @apply border-l-4 border-l-indigo-400; }
.ride-row-border-in-progress{ @apply border-l-4 border-l-amber-400; }
.ride-row-border-picked-up  { @apply border-l-4 border-l-orange-400; }
.ride-row-border-arrived    { @apply border-l-4 border-l-teal-400; }
.ride-row-border-completed  { @apply border-l-4 border-l-green-500; }
.ride-row-border-cancelled  { @apply border-l-4 border-l-slate-300; }
.ride-row-border-rejected   { @apply border-l-4 border-l-red-500; }
.ride-row-border-no-show    { @apply border-l-4 border-l-rose-500; }
```

### 7.7 Formulare

**Grundregeln:**
- Label immer sichtbar, nie als Placeholder-Ersatz (Accessibility)
- Pflichtfelder mit `*` markiert, Erklärung einmalig am Formularanfang
- Inline-Validierung: Fehler erscheinen unter dem Feld, sobald das Feld verlassen wird (nicht bei jedem Keystroke)
- Fehlertext: `text-sm text-destructive mt-1`
- Erfolgs-Toast nach Submit, nicht inline auf dem Formular

**Input-Grössen:**
- Desktop: `h-10` (standard)
- Mobile (Fahrer-Formulare): `h-12 text-base`

**Select-Felder mit Suche:**
- `Command`-Popover (shadcn) statt Standard-Select wenn > 10 Optionen (z.B. Patientenauswahl)
- Placeholder: "Patient suchen..."

### 7.8 Tabellen

**Verwendung:** Fahrtenliste (Tagesansicht), Fahrerranking, Benutzerverwaltung

**Struktur (Ist-Zustand):** shadcn `Table` mit:
- `TableHeader` mit `TableHead` — light gray Hintergrund
- `TableRow` mit `cursor-pointer hover:bg-muted/60`
- Inaktive Zeilen: `opacity-50`
- Status-Spalte: `RideStatusBadge`
- Aktionen-Spalte: `DropdownMenu` (3-Punkte-Menü)

**Empfehlung für dichte Informationen:** Status-Left-Border auf Zeilen (im DispatchBoard bereits vorhanden) auch in der RidesTable einsetzen. Aktuell fehlt dieser visuelle Cue in der Standard-Fahrtentabelle.

### 7.9 Filter-Chips

Für schnelle Filterung ohne Dropdown-Overhead (bereits in DispatchBoard):

```tsx
// Pattern:
<button
  className={cn(
    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
    active
      ? "bg-primary text-primary-foreground"
      : "bg-muted text-muted-foreground hover:bg-muted/70"
  )}
>
  Ungeplant (3)
</button>
```

Diese Chips sollten auch auf der Fahrtenliste eingesetzt werden statt des aktuellen `Select`-Dropdown für den Status-Filter.

### 7.10 Modals, Drawers, Side-Panels

| Pattern | Verwendung | shadcn-Komponente |
|---------|-----------|------------------|
| AlertDialog | Bestätigungsabfragen, destruktive Aktionen | `AlertDialog` |
| Sheet (Right) | Detail-Ansicht ohne Seitennavigation (Patienten, Ziele) | `Sheet side="right"` |
| Dialog | Inline-Formulare (Patient erstellen, Ziel erstellen) | `Dialog` |
| Dropdown | Kontextmenüs auf Tabellenzeilen | `DropdownMenu` |

**Empfehlung:** Side-Panel-Ansicht (Sheet) auch für Fahrt-Schnellansicht in der Disposition — Disponent klickt auf Fahrt und sieht Details + Fahrer-Assign im Sheet, ohne zur Detailseite zu navigieren.

### 7.11 Toast-Benachrichtigungen

**Ist-Zustand:** shadcn `Toast` verfügbar.

**Verwendungsregeln:**
- Erfolgreich gespeichert: `toast({ title: "Gespeichert", description: "Fahrt wurde erstellt." })`
- Fehler: `toast({ variant: "destructive", title: "Fehler", description: "..." })`
- Positionierung: oben-rechts auf Desktop, unten-mitte auf Mobile
- Auto-dismiss: 4 Sekunden für Erfolg, 8 Sekunden für Fehler
- Maximal 2 gleichzeitig sichtbar

### 7.12 Leerzustände (Empty States)

**Ist-Zustand:** `EmptyState`-Komponente in `src/components/shared/empty-state.tsx`.

**Inhalt:**
- Neutrales Icon (kein roter Fehler-Icon bei normalem Leer-Zustand)
- Kurze Erklärung: "Keine Fahrten gefunden."
- Optionaler CTA: "Fahrt erfassen" (falls der Nutzer direkt handeln kann)

---

## Kapitel 8: Design-Empfehlungen für ältere Nutzer

Patientenfahrten werden oft von älteren Patienten direkt telefonisch angemeldet. Die Disponenten selbst sind oft nicht digital-native. Einige Fahrer sind ebenfalls älter.

### 8.1 Schriftgrössen

| Kontext | Mindestgrösse | Empfehlung |
|---------|-------------|-----------|
| Lauftext (Formulare, Tabellen) | 14px (`text-sm`) | 16px (`text-base`) |
| Buttons | 14px | 16px |
| Primäre Fahrtinfos (Fahrer-App) | 24px | 30–32px (`text-3xl`) |
| Tageszeit-Anzeige | 28px | 36px (`text-4xl`) |
| Beschriftungen, Labels | 12px (`text-xs`) | 13–14px |

### 8.2 Touch-Ziele

| Element | Mindesthöhe | Empfehlung |
|---------|------------|-----------|
| Alle Buttons (Mobile) | 44px | 48px (`h-12`) |
| Navigation-Links (Mobile) | 44px | 48px |
| Checkboxen und Radios (Mobile) | 44×44px | 48×48px |
| Tabellen-Zeilen (Mobile) | 44px | — |
| Close-Buttons in Modals | 44×44px | — |

### 8.3 Zeilenabstand und Abstände

- Zeilenabstand in Formularen: `space-y-6` zwischen Feldern (24px) statt `space-y-4` (16px)
- Abstand zwischen Aktionsbuttons: mindestens `gap-3` (12px), bevorzugt `gap-4`
- Card-Innenabstand: `p-6` (`p-7` auf grossen Screens) — bereits so im Code

### 8.4 Farbkontrast

**WCAG AA-Anforderungen:**
- Normaler Text (< 18px): mindestens 4.5:1
- Grosser Text (≥ 18px / ≥ 14px bold): mindestens 3:1
- UI-Komponenten und Grafiken: mindestens 3:1

**Kritische Prüfpunkte:**
- `text-muted-foreground` auf `card` Background: aktuell `hsl(218 19% 44%)` auf `hsl(0 0% 100%)` = ca. 4.7:1 — WCAG AA bestanden
- Status-Badges: Text auf farbigem Hintergrund muss geprüft werden, besonders bei Amber-Hintergründen
- Buttons im Header (`text-slate-100/90` auf `bg-slate-900/85`): sehr guter Kontrast

**Problempunkte (empfohlen zu prüfen):**
- `RIDE_STATUS_COLORS` für amber/orange-basierte Badges: `text-amber-700 bg-amber-100` — amber-700 auf amber-100 ergibt ca. 3.2:1, für kleine Texte unter 4.5:1 — ggf. auf `text-amber-800` erhöhen

### 8.5 Icon-Einsatz

**Grundregel:** Icons immer mit Text-Label kombinieren. Ausnahmen nur bei extrem etablierten Symbolen (Lupe für Suche, X für Schliessen) — und auch dort mit `aria-label`.

**Verbotene reine Icon-Buttons:**
- Aktions-Icons ohne Label in komplexen Workflows (die Bedeutung von "Bearbeiten" ist nicht universell klar)

**Empfehlung:** In Tabellen-Aktionsmenüs sind Icon+Text-Kombinationen besser als reine Icons.

### 8.6 Formulargestaltung

- Fehlermeldungen unmittelbar unter dem betreffenden Feld
- Keine roten Markierungen vor der Interaktion (kein Pre-Validation-Error)
- Fehlertext in Prosa: "Die Abholzeit muss angegeben werden." statt "Pflichtfeld"
- Erfolgsbestätigung mit Toast, nicht mit Inhaltsveränderung auf der Seite
- Bei Zeitfeldern: Beispiel-Placeholder `"z.B. 08:30"` anzeigen
- Lange Formulare mit klaren Abschnitten (Card-Blöcke mit Überschrift)

### 8.7 Orientierungshilfen

- Immer sichtbar: Wo bin ich? (aktiver Nav-Link hervorgehoben, `bg-white text-slate-900`)
- Zurück-Navigation: `backHref`/`backLabel` im PageHeader (bereits implementiert)
- Breadcrumbs bei tiefer Navigation (z.B. `/drivers/[id]/availability` → "Fahrer > Müller Hans > Verfügbarkeit")
- Keine Auto-Redirects nach Aktionen, die den Nutzer überraschen — immer Toast + expliziter Bleib-auf-Seite oder Redirect nach 1–2 Sekunden

---

## Kapitel 9: Designrichtung / Look & Feel

### 9.1 Visuelles Konzept: "Operationale Klarheit"

Die App ist kein Consumer-Produkt und kein Marketing-Tool. Sie ist ein professionelles Betriebssystem für eine wichtige gesellschaftliche Aufgabe (Patientenfahrten).

**Stimmung:**
- Ruhig, aber nicht kalt
- Professionell, aber nicht steril
- Klar strukturiert, aber nicht rigide
- Vertrauenswürdig, aber nicht langweilig

**Referenz-Feeling:**
- Linear.app für Dichte und Klarheit
- Notion für strukturierte Informationshierarchie
- Intercom für warme Funktionalität
- Nicht: Healthcare-App-Clichés (weiss-blau, zu klinisch)

### 9.2 Farbstimmung

**Hintergrund:**
- Leichtes Blau-Grau als Seitenhintergrund: `hsl(213 45% 98%)` (bereits so)
- Radiale Gradienten als subtile Tiefenwirkung (bereits im `body`-Styling)
- Karten heben sich klar ab durch `glass-panel`-Effekt (bereits so)

**Header:**
- Dunkler Slate-Header (`bg-slate-900/85`) mit Backdrop-Blur schafft klare Trennung zur Arbeitsfläche
- Weisse Navigationstexte schaffen guten Kontrast
- Das "FD"-Logo in weisser Box — wirkt seriös und erkennbar

**Akzente:**
- Primärblau `hsl(211 96% 42%)` — kräftig, klar, medizinisch-professionell assoziiert
- Status-Farben als Signalfarben, nie für Dekoration
- Amber/Gelb sparsam für Warnungen

### 9.3 Rundungen

Aktuelle Einstellung: `--radius: 0.9rem` (ca. 14px) für Cards, Buttons abgeleitet davon.

**Bewertung:** Dieser Radius ist angenehm weich ohne verspielt zu wirken. Passt gut zur angestrebten Stimmung. Keine Änderung empfohlen.

**Ausnahme:** Tabellen haben keine Rundung auf Zeilen (absichtlich, flache Struktur für Dichte).

### 9.4 Schatten

`glass-panel` verwendet `shadow-xl shadow-slate-900/5` — sehr subtil, funktioniert gut.

**Regel:** Keine mehrlagigen Schatten oder opulente Tiefen-Effekte. Schatten nur für Elevation-Hierarchie, nicht für Dekoration.

### 9.5 Leerräume

- Sektions-Abstände: `space-y-6` (24px) zwischen Haupt-Content-Bereichen
- Card-Innenabstand: `p-6` (Standard) / `p-7` (gross)
- Tabellen-Zeilen: Standard shadcn Padding — nicht zu kompakt auf Mobile reduzieren

### 9.6 Icons

**Bibliothek:** Lucide (via shadcn/ui — bereits eingebunden)

**Stil:** Outline-Icons, 1.5px Stroke, einheitlich. Grösse: `h-4 w-4` (Standard), `h-5 w-5` (prominent).

**Konsistente Icon-Zuweisungen:**
| Element | Icon |
|---------|------|
| Dashboard | `Gauge` |
| Fahrten | `CarFront` |
| Disposition | `Compass` |
| Fahrer | `UserRound` |
| Patienten | `Hospital` |
| Ziele | `MapPin` |
| Verrechnung | `CreditCard` |
| Einstellungen | `Settings` |
| Neue Fahrt | `Plus` |
| Bearbeiten | `Pencil` |
| Löschen | `Trash2` |
| Navigation | `Navigation` |
| Abgeholt | `CheckCircle` |
| Warnung | `AlertTriangle` |
| Fehler | `AlertCircle` |
| Uhrzeit | `Clock` |
| Kalender | `CalendarDays` |
| Route | `Route` |
| Karte | `Map` |

---

## Kapitel 10: Wireframe-Beschreibungen

### 10.1 Dashboard (Desktop, 1920×1080)

```
┌─ HEADER (62px, slate-900/85) ─────────────────────────────────────────────────────┐
│  [FD Logo]  Dashboard | Fahrten | Disposition | Fahrer | Serie... | Patienten... │ [Abmelden] │
└────────────────────────────────────────────────────────────────────────────────────┘

┌─ MAIN (max-w-7xl, px-4..lg:px-8, py-8) ────────────────────────────────────────────┐
│                                                                                     │
│  ┌── ACTIVITY BANNER (cyan, 40px) ────────────────────────────────────────────┐    │
│  │  ● Live-Dispositionsumgebung                                                │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                     │
│  h2: "Dashboard"                                                                    │
│                                                                                     │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐                      │
│  │ Heute      │ │ Ungeplant  │ │ Aktive     │ │ Abge-      │                      │
│  │ gesamt     │ │ [AlertIcon]│ │ Fahrten    │ │ schlossen  │                      │
│  │            │ │            │ │            │ │            │                      │
│  │  [42]      │ │  [3]  ROT  │ │  [8]       │ │  [31]      │                      │
│  │            │ │ Sofort     │ │            │ │            │                      │
│  │            │ │ handeln!   │ │            │ │            │                      │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘                      │
│                                                                                     │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐                      │
│  │Diese Woche │ │ Nächste W. │ │Letzt. Mon. │ │Fahrer heute│                      │
│  │  [187]     │ │  [220]     │ │  [743]     │ │  [7/12]    │                      │
│  │ Ausfall 2% │ │Ungeplant 5 │ │ Abschl.97% │ │Idle: 2     │                      │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘                      │
│                                                                                     │
│  ┌── IDLE FAHRER BANNER (amber, conditional) ─────────────────────────────────┐    │
│  │  ⚠ Verfügbare Fahrer ohne Fahrt: [Müller, Hans] [Schmidt, Beat]             │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                     │
│  ┌─────────────────────────────┐ ┌─────────────────────────────┐                  │
│  │ Handlungsbedarf             │ │ Nächste Fahrten             │                  │
│  ├─────────────────────────────┤ ├─────────────────────────────┤                  │
│  │ ┌── FAHRT (red-l-border) ─┐ │ │ ┌── FAHRT ─────────────┐   │                  │
│  │ │ 07:15 Huber, Maria      │ │ │ │ 09:00 Meier, Josef   │   │                  │
│  │ │ KSG   [Ungeplant badge] │ │ │ │ Spital [Bestätigt]   │   │                  │
│  │ └────────────────────────┘  │ │ └──────────────────────┘   │                  │
│  │ ┌── FAHRT (amber-l-border)┐ │ │ ┌── FAHRT ─────────────┐   │                  │
│  │ │ 08:30 Keller, Hans      │ │ │ │ 09:15 ...            │   │                  │
│  │ │ Arzt  [Geplant badge]   │ │ │ │                      │   │                  │
│  │ └────────────────────────┘  │ │ └──────────────────────┘   │                  │
│  │ Alle anzeigen →              │ │ Alle anzeigen →             │                  │
│  └─────────────────────────────┘ └─────────────────────────────┘                  │
│                                                                                     │
│  [... Offene Fahrten | Fahrten ohne Fahrer — 2-Col]                                │
│                                                                                     │
│  [... Fahrer-Ranking — Full-width Tabelle]                                         │
│                                                                                     │
│  [... Heutige Standorte — Karte 400px]                                             │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 10.2 Disposition Tagesansicht (Desktop)

```
┌─ HEADER ─────────────────────────────────────────────────────────────────────────┐
│  [nav...]                                                                         │
└──────────────────────────────────────────────────────────────────────────────────┘
┌─ MAIN ───────────────────────────────────────────────────────────────────────────┐
│                                                                                   │
│  glass-panel: "Disposition" | Tagesübersicht und Fahrerzuweisung                 │
│                                                                                   │
│  ┌── ACCEPTANCE QUEUE (amber, falls vorhanden) ──────────────────────────────┐   │
│  │  Offene Zuweisungen:                                                       │   │
│  │  [Fahrt-Card: Müller → Huber | 07:15 | ● Ausstehend | [Details] [Storno]] │   │
│  └────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                   │
│  ┌── DISPATCH BOARD ──────────────────────────────────┬── DRIVER SIDEBAR ────┐   │
│  │                                                    │                      │   │
│  │  [◀ Mo] [Di, 17. März 2026] [Mi ▶] [Heute]        │  Fahrer heute        │   │
│  │                                                    │  ──────────────────  │   │
│  │  Filter: [Alle●] [Ungeplant 3] [Geplant 5] ...    │  ┌ Müller, Hans    ┐ │   │
│  │                                                    │  │ PKW             │ │   │
│  │  ┌── FAHRT (red-l-border) ──────────────────┐     │  │ ab 08:00 Uhr   │ │   │
│  │  │ 🔴 07:15  Huber, Maria    Ungeplant       │    │  │ 3 Fahrten heute│ │   │
│  │  │           KSG             [Fahrer▼ ──── ] │    │  └────────────────┘ │   │
│  │  └─────────────────────────────────────────┘     │  ┌ Schmidt, Beat   ┐ │   │
│  │                                                    │  │ Rollstuhl       │ │   │
│  │  ┌── FAHRT (blue-l-border) ─────────────────┐     │  │ ab 10:00 Uhr   │ │   │
│  │  │ 🔵 08:00  Meier, Josef    Geplant         │    │  │ 1 Fahrt heute  │ │   │
│  │  │           Spital Grabs    Müller, Hans     │    │  └────────────────┘ │   │
│  │  └─────────────────────────────────────────┘     │                      │   │
│  │                                                    │  Nicht verfügbar     │   │
│  │  ┌── FAHRT (indigo-l-border) ───────────────┐     │  ──────────────────  │   │
│  │  │ 🟣 08:30  Keller, Werner  Bestätigt       │    │  ┌ Keller, Peter   ┐ │   │
│  │  │           Therapie Z.     Schmidt, Beat    │    │  │ (kein Eintrag) │ │   │
│  │  └─────────────────────────────────────────┘     │  └────────────────┘ │   │
│  │                                                    │                      │   │
│  └────────────────────────────────────────────────────┴──────────────────────┘   │
│                                                                                   │
└───────────────────────────────────────────────────────────────────────────────────┘
```

### 10.3 Fahrer-Hauptansicht (Mobile, 390px)

```
┌─ HEADER (62px, slate-900) ──────────────────────┐
│  [FD]  Meine Fahrten              [Abmelden]     │
│         [●] [Verfügbarkeit]                      │
└──────────────────────────────────────────────────┘

┌─ SCREEN ─────────────────────────────────────────┐
│                                                  │
│  Montag, 16. März 2026                           │
│  ████████░░  3 von 5 erledigt                    │
│                                                  │
│  ┌── OFFENE ZUWEISUNG (amber-l-border, 5px) ──┐ │
│  │  07:15             [● Ausstehend]           │ │
│  │  Huber, Maria                               │ │
│  │  Kantonsspital St. Gallen                   │ │
│  │  Hinfahrt                                   │ │
│  │  ─────────────────────────────────────────  │ │
│  │  ┌─────────────────┐ ┌─────────────────┐   │ │
│  │  │    Annehmen     │ │    Ablehnen     │   │ │
│  │  │   (grün, h-12)  │ │ (outline rot)   │   │ │
│  │  └─────────────────┘ └─────────────────┘   │ │
│  └──────────────────────────────────────────────┘ │
│                                                  │
│  ┌── FAHRT (blue-l-border, 5px) ─────────────┐  │
│  │  09:30             [● Bestätigt]          │  │
│  │  Keller, Werner                            │  │
│  │  Therapiezentrum                           │  │
│  │  Hinfahrt                                  │  │
│  │  ─────────────────────────────────────────  │  │
│  │  [Navigation starten ↗]  (link, klein)    │  │
│  │  ─────────────────────────────────────────  │  │
│  │  ┌────────────────────────────────────┐   │  │
│  │  │         Fahrt starten              │   │  │
│  │  │         (blau, h-12, w-full)       │   │  │
│  │  └────────────────────────────────────┘   │  │
│  │  ┌────────────────────────────────────┐   │  │
│  │  │           Ablehnen                 │   │  │
│  │  │       (outline rot, h-12)          │   │  │
│  │  └────────────────────────────────────┘   │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌── FAHRT (green-l-border) ─────────────────┐  │
│  │  07:00             [● Erledigt]           │  │
│  │  Meier, Anna                               │  │
│  │  Arztpraxis Dr. Wirth                      │  │
│  │  Hin & Rück ✓                              │  │
│  │  (keine Aktionsbuttons, terminal)          │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
└──────────────────────────────────────────────────┘
```

### 10.4 Fahrtformular (Desktop, 2-Spalten)

```
┌─ MAIN (max-w-5xl) ───────────────────────────────────────────────────────────────┐
│                                                                                   │
│  glass-panel: "Neue Fahrt erfassen"                                               │
│                                                                                   │
│  ┌── FORMULAR (flex-1) ───────────────────────┬── VORSCHAU (w-80) ─────────────┐ │
│  │                                            │                                 │ │
│  │  ┌── PATIENT ───────────────────────────┐  │  RideTimeline                   │ │
│  │  │  Label: Patient *                    │  │  ┌───────────────────────────┐  │ │
│  │  │  [Combobox: Patient suchen...  ▼][+] │  │  │ ○ 07:15 Abholung          │  │ │
│  │  └──────────────────────────────────────┘  │  │ │ Musterstrasse 12         │  │ │
│  │                                            │  │ │                           │  │ │
│  │  ┌── FAHRTDATEN ────────────────────────┐  │  │ ○ 07:45 Ankunft           │  │ │
│  │  │  [Datum ████████████] [Abholzeit ██] │  │  │ │ KSG Eingang              │  │ │
│  │  │                                      │  │  │                           │  │ │
│  │  │  Richtung:  ○ Hinfahrt               │  │  │ ○ 11:00 Rückfahrt         │  │ │
│  │  │             ○ Rückfahrt              │  │  │   (Termin + 30 Min Puffer) │  │ │
│  │  │             ○ Hin & Rück [aktiv]     │  │  └───────────────────────────┘  │ │
│  │  │                                      │  │                                 │ │
│  │  │  Termin-Uhrzeit: [10:30 ██]          │  │  ┌───────────────────────────┐  │ │
│  │  │  ↳ Rückfahrt ca. 11:00               │  │  │  [ROUTE-KARTE 200px]      │  │ │
│  │  └──────────────────────────────────────┘  │  │  St. Gallen → KSG         │  │ │
│  │                                            │  └───────────────────────────┘  │ │
│  │  ┌── ZIEL & FAHRER ─────────────────────┐  │                                 │ │
│  │  │  Ziel:   [Combobox: Ziel wählen ▼][+]│  │  Distanz: 4.2 km               │ │
│  │  │  Fahrer: [Combobox: Fahrer wählen ▼] │  │  Dauer:   12 Min               │ │
│  │  │  Fahrzeugt.: [PKW ▼]                 │  │                                 │ │
│  │  └──────────────────────────────────────┘  │                                 │ │
│  │                                            │                                 │ │
│  │  ┌── OPTIONAL ──────────────────────────┐  │                                 │ │
│  │  │  Notizen: [textarea, 3 rows]         │  │                                 │ │
│  │  │  ☐ Als Fahrserie einrichten          │  │                                 │ │
│  │  └──────────────────────────────────────┘  │                                 │ │
│  │                                            │                                 │ │
│  │  [Route berechnen]  (outline button)       │                                 │ │
│  │                                            │                                 │ │
│  │  ──────────────────────────────────────    │                                 │ │
│  │  [Abbrechen] (ghost)   [Fahrt speichern]   │                                 │ │
│  │                                            │                                 │ │
│  └────────────────────────────────────────────┴─────────────────────────────────┘ │
│                                                                                   │
└───────────────────────────────────────────────────────────────────────────────────┘
```

### 10.5 Wochenkalender Fahrten (Desktop)

```
┌─ MAIN ───────────────────────────────────────────────────────────────────────────┐
│                                                                                   │
│  glass-panel: "Fahrten" | Wochenübersicht | [+ Neue Fahrt]                       │
│                                                                                   │
│  ┌── WEEK NAV ────────────────────────────────────────────────────────────────┐  │
│  │  [◀ Vorherige Woche]  [16. – 22. März 2026]  [Nächste Woche ▶]  [Heute]   │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                   │
│  ┌── 7-SPALTEN-GRID ──────────────────────────────────────────────────────────┐  │
│  │                                                                            │  │
│  │  Mo 16   Di 17   Mi 18   Do 19   Fr 20   Sa 21   So 22                   │  │
│  │  [●]                [!]                                                    │  │
│  │  ──────  ──────   ──────  ──────  ──────  ──────  ──────                 │  │
│  │  07:15   08:00    06:45   09:00                                           │  │
│  │  [MH ●]  [SB ●]  [GM ●]  [KL ●]                                         │  │
│  │                                                                            │  │
│  │  09:30             14:00                                                   │  │
│  │  [TM ●]           [FM ●]                                                   │  │
│  │                                                                            │  │
│  │  11:00             + 3    09:30                                            │  │
│  │  [KW ●]           wei-    [SB ●]                                          │  │
│  │                   tere                                                     │  │
│  │  + Fahrt   + Fahrt  + Fa.   + Fa.   + Fa.   ---    ---                   │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                   │
│  Legende: ● = Status-Farbpunkt | [!] = Ungeplante Fahrten | [●] = Dringend      │
│                                                                                   │
└───────────────────────────────────────────────────────────────────────────────────┘
```

---

## Kapitel 11: Priorisierte MVP-Empfehlung

### Tier 1: Muss (kritisch für Betrieb)

Diese Bereiche sind für den täglichen Betrieb unerlässlich. Wenn sie fehlen oder schlecht sind, blockiert das den Arbeitsprozess.

| Priorität | Screen/Feature | Status | Empfohlene Massnahme |
|-----------|---------------|--------|---------------------|
| P1 | Dashboard mit Handlungsbedarf | Implementiert | Kleinere Optimierungen (Idle-Fahrer-Link zur Disposition) |
| P1 | Fahrtenliste Tages- + Wochenansicht | Implementiert | Status-Left-Border in RidesTable ergänzen |
| P1 | Neue Fahrt erfassen (Formular) | Implementiert | Layout-Optimierung: 2-Spalten auf Desktop |
| P1 | Disposition Tagesansicht (DispatchBoard) | Implementiert | max-w-none für breiteres Layout erwägen |
| P1 | Fahrer-Ansicht (MyRidesList) | Implementiert | Fortschrittsbalken + Navigation-Deep-Link ergänzen |
| P1 | RideStatusBadge | Implementiert | Grössen-Variante für kompakte Ansichten |
| P1 | Status-Transitions (valide Übergänge) | Implementiert | Keine Änderung |
| P1 | Acceptance-Flow (E-Mail, Annehmen/Ablehnen) | Implementiert | Keine Änderung |

### Tier 2: Sollte (stark verbessert die UX)

Diese Features sind nicht blockierend, verbessern aber die Effizienz erheblich.

| Priorität | Screen/Feature | Status | Empfohlene Massnahme |
|-----------|---------------|--------|---------------------|
| P2 | Status-Left-Border in RidesTable | Fehlt | Implementieren (einfach) |
| P2 | Filter-Chips statt Select-Dropdown auf Fahrtenliste | Fehlt | Implementieren |
| P2 | Fahrt-Schnell-Sheet in Disposition (ohne Seitennavigation) | Fehlt | Side-Sheet mit Fahrdetails |
| P2 | Navigation-Deep-Link in Fahrer-App | Fehlt | Einfache URL-Konstruktion |
| P2 | Fortschrittsanzeige in Fahrer-App | Fehlt | Einfache Berechnung + Progressbar |
| P2 | Fahrerliste als Card-Grid (analog zu Patienten/Ziele) | Fehlt | Drivers-Grid-Komponente |
| P2 | Zeitkonflikt-Warnung in Disposition | Fehlt | Algorithmische Prüfung + Inline-Warnung |
| P2 | Navigation-Breadcrumb bei tiefer Navigation | Fehlt | Einfache Breadcrumb-Komponente |
| P2 | Direktlink "Fahrt für Patient erfassen" in Patient-Sheet | Fehlt | URL-Parameter-Passing |

### Tier 3: Später (wünschenswert, aber kein Betriebshindernis)

| Priorität | Screen/Feature | Status | Empfohlene Massnahme |
|-----------|---------------|--------|---------------------|
| P3 | Live-Karte mit Fahrerpositionen | Fehlt | Erfordert Echtzeit-Infrastruktur |
| P3 | Fahrer-Detail mit visueller Verfügbarkeitsansicht | Fehlt | Grid-Komponente |
| P3 | Verbesserte Navigation (Sidebar oder Gruppenstruktur) | Diskutieren | Aufwand vs. Nutzen abwägen |
| P3 | Dunkel-Modus (Dark Mode) | Implementiert in CSS | Testing + Polishing |
| P3 | Offline-Fähigkeit für Fahrer-App | Fehlt | Service Worker + PWA |
| P3 | Statistik-Charts auf Dashboard | Fehlt | Charting-Library (recharts/visx) |
| P3 | Konflikte automatisch erkennen + in Disposition anzeigen | Fehlt | Algorithmus + UI |

### Empfohlene Sprint-Planung

**Sprint 1 (1–2 Wochen): Quick-Wins ohne Regressions-Risiko**
- Status-Left-Border in RidesTable
- Filter-Chips auf Fahrtenliste
- Navigation-Deep-Link in Fahrer-App
- Fortschrittsanzeige in Fahrer-App

**Sprint 2 (2–3 Wochen): Disposition verbessern**
- Fahrt-Schnell-Sheet (Side-Panel in Dispatch)
- Zeitkonflikt-Erkennung + Inline-Warnung
- Fahrer-Grid-Ansicht

**Sprint 3 (2–3 Wochen): Informationsarchitektur**
- Navigation-Gruppe / Sidebar (wenn Konsens besteht)
- Breadcrumb-Komponente
- Direkt-Links zwischen Entitäten (Patient → Fahrt erfassen)

---

## Kapitel 12: UX-Fallen vermeiden

### 12.1 Status-Farben mit anderem Kontext überschreiben

**Falle:** Eine grüne Farbe für etwas verwenden, das nicht "abgeschlossen" oder "Erfolg" bedeutet.

**Beispiel:** Einen grünen Badge für "Heute" verwenden, obwohl Grün im System "Erledigt" bedeutet.

**Vermeidung:** Die Status-Farbpalette ist reserviert. Für andere semantische Bedeutungen neue Tokens einführen oder Tailwind-Direktfarben verwenden.

### 12.2 Loading-States vergessen

**Falle:** Während einer Server Action läuft, bleibt der Button klickbar oder zeigt keine Reaktion.

**Aktueller Stand:** `useTransition` und `isPending` werden bereits konsequent verwendet — dieser Fehler ist grösstenteils vermieden.

**Ergänzung:** Bei Seiten mit vielen parallelen Supabase-Queries sollte ein Skeleton-Loading-State für jeden Datenbereich existieren (via `<Suspense>`).

### 12.3 Destruktive Aktionen ohne Bestätigung

**Falle:** Stornieren, Löschen, Deaktivieren ohne Rückfrage.

**Vermeidung:** Alle destruktiven Aktionen immer mit `AlertDialog`. Beschreibungstext muss spezifisch sein: "Fahrt 'Huber, Maria – 07:15 Uhr' wirklich stornieren?" — nicht nur "Wirklich löschen?".

### 12.4 Nur-Farb-Kodierung

**Falle:** Status nur durch Farbe kommunizieren, ohne Text oder Form.

**Vermeidung:** Status immer mindestens doppelt kodiert: Farbe + Text (Badge) oder Farbe + Icon. Der `RideStatusBadge` macht das korrekt mit Farbpunkt + Label.

### 12.5 Einheitliches Layout für unterschiedliche Kontexte

**Falle:** Das DispatchBoard und die Patienten-Übersicht mit demselben `max-w-7xl`-Container layouten, obwohl der Dispatch-Screen mehr Breite benötigt.

**Vermeidung:** Layout-Container kontextspezifisch wählen:
- Standard CRUD-Pages: `max-w-7xl`
- Kartenansichten + Dispatch: `max-w-none` oder `max-w-screen-2xl`

### 12.6 Formular-Validierung zu früh

**Falle:** Fehlermeldungen erscheinen bereits beim ersten Laden des Formulars oder beim ersten Keystroke.

**Vermeidung:** Validierung erst nach `onBlur` (Feld verlassen) oder nach Submit. Supabase-Zod-Validierung im Server Action sollte Fehler pro Feld zurückgeben (`useFormState`), die dann inline angezeigt werden.

### 12.7 Mobile-Ansicht mit Desktop-Interaktionsmustern

**Falle:** Hover-States, die auf Mobile nicht funktionieren. Dropdown-Menüs, die auf Mobile schwer zu treffen sind.

**Vermeidung:** Für Fahrer-App: Keine Hover-States als primäres UI-Element. Keine Dropdown-Menüs (schwer auf Mobile). Stattdessen: Direkte Buttons. Bei 3-Punkte-Menüs: Bottom-Sheet-Variante auf Mobile.

### 12.8 Inconsistente Datumsformate

**Falle:** Datum mal als `2026-03-16`, mal als `16.3.26`, mal als `Montag, 16. März 2026`.

**Vermeidung:** Konvention festlegen und in `src/lib/utils/dates.ts` konsolidieren (bereits vorhanden). Grundregel:
- Kurzdatum in Listen: `16.03.` (ohne Jahr, wenn offensichtlich aktuell)
- Vollständiges Datum: `Montag, 16. März 2026`
- ISO für URL-Parameter: `2026-03-16`
- Uhrzeit: `07:15` (immer ohne Sekunden in der UI)

### 12.9 Unklare Leer-Zustände

**Falle:** Leere Tabelle oder Liste ohne Kontext — warum ist sie leer? Was kann der Nutzer tun?

**Vermeidung:** Jeder Leer-Zustand erklärt, warum er leer ist und bietet eine direkte Aktion an:
- "Keine Fahrten für heute." + Button "Fahrt erfassen"
- "Keine Fahrer gefunden." + Button "Fahrer hinzufügen"
- "Keine Suchergebnisse." (wenn Suche aktiv ist — kein CTA, da die Suche der Grund ist)

### 12.10 Zu viele Informationen gleichzeitig

**Falle:** Alle verfügbaren Daten auf dem Dashboard anzeigen. Jeder Card alles mitgeben.

**Vermeidung:** Progressive Disclosure konsequent anwenden. Das Dashboard zeigt Kennzahlen und die 5 wichtigsten Einzeleinträge. Details gehören auf die Detailseite. Wenn eine Karte mehr als 3–4 Datenfelder hat, sollten einige in einer expandierbaren Sektion oder in einem Sheet versteckt werden.

---

## Bonus: Design-System-Startpaket

### Komponenten-Namenskonventionen und Dateistruktur

```
src/
├── components/
│   ├── ui/                          # shadcn/ui (nicht verändern)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── sheet.tsx
│   │   ├── alert-dialog.tsx
│   │   ├── badge.tsx
│   │   ├── ...
│   │
│   ├── shared/                      # Projektweite wiederverwendbare Komponenten
│   │   ├── ride-status-badge.tsx    # EXISTIERT: Status-Badge mit Dot + Label
│   │   ├── active-badge.tsx         # EXISTIERT: Aktiv/Inaktiv-Badge
│   │   ├── empty-state.tsx          # EXISTIERT: Leerzustand mit optionalem CTA
│   │   ├── submit-button.tsx        # EXISTIERT: Loading-fähiger Submit-Button
│   │   ├── address-fields.tsx       # EXISTIERT: Adressfelder-Gruppe
│   │   ├── route-map.tsx            # EXISTIERT: Eingebettete Route-Karte
│   │   ├── location-map.tsx         # EXISTIERT: Einzelner Pin
│   │   ├── week-nav.tsx             # EXISTIERT: Wochennavigation
│   │   ├── deactivate-dialog.tsx    # EXISTIERT: Deaktivierungs-Bestätigung
│   │   ├── status-filter-chips.tsx  # NEU: Status-Filter als Chips
│   │   ├── progress-bar.tsx         # NEU: Fortschrittsbalken (Fahrer-App)
│   │   └── breadcrumb.tsx           # NEU: Breadcrumb-Navigation
│   │
│   ├── dashboard/                   # Layout-Komponenten des Dashboards
│   │   ├── dashboard-nav.tsx        # EXISTIERT: Horizontale Navigation
│   │   ├── page-header.tsx          # EXISTIERT: Seiten-Kopfzeile mit glass-panel
│   │   ├── dashboard-map.tsx        # EXISTIERT: Static-API-Karte
│   │   └── stat-card.tsx            # NEU: Wiederverwendbare KPI-Karte
│   │
│   ├── rides/                       # Fahrt-spezifische Komponenten
│   │   ├── ride-form.tsx            # EXISTIERT: Create/Edit-Formular
│   │   ├── rides-table.tsx          # EXISTIERT: Tabellenansicht
│   │   ├── rides-week-view.tsx      # EXISTIERT: Wochenkalender
│   │   ├── rides-day-map.tsx        # EXISTIERT: Tageskarte
│   │   ├── ride-timeline.tsx        # EXISTIERT: Zeitstrahl-Vorschau
│   │   ├── ride-detail-map.tsx      # EXISTIERT: Detail-Karte
│   │   ├── communication-timeline.tsx # EXISTIERT: Kommunikations-Log
│   │   └── ride-quick-sheet.tsx     # NEU: Side-Sheet für Schnellansicht
│   │
│   ├── dispatch/                    # Dispositions-Komponenten
│   │   ├── dispatch-board.tsx       # EXISTIERT: Tages-Disposition
│   │   └── dispatch-week-view.tsx   # EXISTIERT: Wochen-Disposition
│   │
│   ├── drivers/                     # Fahrer-Komponenten
│   │   ├── drivers-table.tsx        # EXISTIERT: Tabellenansicht
│   │   ├── driver-form.tsx          # EXISTIERT: Formular
│   │   ├── driver-card.tsx          # NEU: Card für Grid-Ansicht
│   │   └── driver-detail-sheet.tsx  # NEU: Detail-Sheet
│   │
│   ├── patients/                    # Patienten-Komponenten
│   │   ├── patient-card.tsx         # EXISTIERT
│   │   ├── patient-detail-sheet.tsx # EXISTIERT
│   │   ├── patient-form.tsx         # EXISTIERT
│   │   └── patient-inline-dialog.tsx # EXISTIERT
│   │
│   ├── destinations/                # Ziele-Komponenten
│   │   ├── destination-card.tsx     # EXISTIERT
│   │   ├── destination-detail-sheet.tsx # EXISTIERT
│   │   ├── destination-form.tsx     # EXISTIERT
│   │   └── destination-inline-dialog.tsx # EXISTIERT
│   │
│   ├── my-rides/                    # Fahrer-Ansicht
│   │   ├── my-rides-list.tsx        # EXISTIERT
│   │   └── pending-assignments.tsx  # EXISTIERT
│   │
│   └── acceptance/                  # Acceptance-Flow
│       ├── acceptance-queue.tsx     # EXISTIERT
│       ├── acceptance-stage-badge.tsx # EXISTIERT
│       └── rejection-dialog.tsx     # EXISTIERT
```

### Neue Komponenten-Spezifikationen (NEU zu erstellen)

#### `StatCard` (`src/components/dashboard/stat-card.tsx`)

```tsx
interface StatCardProps {
  title: string
  value: number | string
  icon: LucideIcon
  iconColorClass: string      // z.B. "text-blue-600"
  iconBgClass: string         // z.B. "bg-blue-100"
  variant?: "default" | "warning" | "critical" | "success"
  subtitle?: string
  subtitleValue?: string
  subtitleColorClass?: string
}
```

Ersetzt die 8 doppelten Stat-Card-Blöcke im Dashboard.

#### `StatusFilterChips` (`src/components/shared/status-filter-chips.tsx`)

```tsx
interface StatusFilterChipsProps {
  statuses: Enums<"ride_status">[]
  counts: Partial<Record<Enums<"ride_status">, number>>
  value: string
  onChange: (value: string) => void
  showAll?: boolean
}
```

Ersetzt den `Select`-Dropdown für Status-Filter.

#### `RideQuickSheet` (`src/components/rides/ride-quick-sheet.tsx`)

```tsx
interface RideQuickSheetProps {
  rideId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  drivers: DispatchDriver[]
  onDriverAssigned?: () => void
}
```

Side-Sheet mit Fahrt-Details + Fahrer-Assign, ohne zur Detailseite navigieren zu müssen.

#### `ProgressBar` (`src/components/shared/progress-bar.tsx`)

```tsx
interface ProgressBarProps {
  completed: number
  total: number
  className?: string
}
// Rendering: X von Y erledigt + visueller Balken
```

### CSS-Token-Erweiterungen (empfohlen, noch nicht implementiert)

```css
/* In globals.css :root ergänzen: */
--panel-dispatch-sidebar: 320px;   /* Bereits als Tailwind-Klasse im Code, aber nicht als Token */
--panel-map: 400px;                /* Kartenhöhe auf Desktop */
--panel-map-mobile: 280px;         /* Kartenhöhe auf Mobile */
--transition-fast: 150ms;          /* Standard Transition-Dauer */
--transition-normal: 200ms;        /* Standard Transition-Dauer (bereits in Button) */
```

### Tailwind-Erweiterungen (empfohlen)

```ts
// In tailwind.config.ts theme.extend ergänzen:
height: {
  "map-desktop": "var(--panel-map)",
  "map-mobile": "var(--panel-map-mobile)",
  "touch-target": "44px",
  "touch-target-lg": "48px",
},
width: {
  "panel-ride-list": "var(--panel-ride-list)",     // Bereits vorhanden
  "panel-dispatch-sidebar": "var(--panel-dispatch-sidebar)",
},
```

---

## Anhang: Verwendete Quellen und Entscheide

| Entscheid | Begründung | Datum |
|-----------|-----------|-------|
| Glass-panel als Standard-Card-Stil | Bereits etabliert, passt zur angestrebten Stimmung | Vorhergehende Sessions |
| Inter als einzige Schriftart | Ausreichende Gewichte, bereits geladen via next/font | Session 2 |
| Status-Farbsystem mit 10 Tokens | Vollständige Abdeckung aller Fahrt-Zustände | Session 2 |
| shadcn/ui neutral theme | Produktionsbewährt, leicht anpassbar, konsistent | Projektstartpunkt |
| max-w-7xl für Standard-Seiten | Konsistent, leicht lesbar auf 1440px Desktop | Layoutentscheid |
| Card-Grid für Patienten/Ziele | Bessere Scannability als Tabelle für Stammdaten | Session 4 |
| Sheet für Detail-Ansicht (Patienten/Ziele) | Kein Seitennavigations-Overhead | Session 4 |
| Wochenkalender als Standard-Startansicht | Überblick vor Detail | Session 5 |
| Google Maps Static API für Dashboard | Performance, keine JS-Abhängigkeit | Session 5 |
| Acceptance-Flow per E-Mail | Fahrer werden proaktiv benachrichtigt, kein Polling-App | Session 3 |

---

*Dieses Dokument ist ein lebendes Dokument und wird mit jeder Entwicklungsphase aktualisiert.*
