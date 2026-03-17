# Disponent Workflow: IST-Zustand & Optimierungskonzept

---

> **Zweck:** Den tatsächlichen Arbeitsalltag eines Disponenten dokumentieren — so wie er heute abläuft (IST), inkl. aller Doppelspurigkeiten, Medienbrüche und Workarounds. Daraus leiten wir das SOLL-Konzept für die FahrdienstApp ab.
>
> **Zielgruppe Disponenten:** 60+, nicht digital-nativ, verlässlich in ihren gelernten Abläufen, skeptisch gegenüber Veränderung. Die App muss ihren bestehenden Workflow vereinfachen — nicht ersetzen.
>
> **Aktueller Status (validiert, 17.03.2026):**
> - Aufträge kommen zu **70–80% per Telefon** ✅ bestätigt
> - **Altsystem ist eine Microsoft Access-Datenbank mit eigenem Frontend** — nicht Excel
> - FahrdienstApp ist **teilweise parallel im Einsatz** (Access-DB + neue App nebeneinander) ⚠️
> - Fahrer kommunizieren via **Telefon + E-Mail** mit dem Disponenten

> ⚠️ **Kritische Phase: Parallelbetrieb Access-DB + neue App**
>
> Die FahrdienstApp ist bereits teilweise im Einsatz, aber die Disponenten arbeiten **weiterhin parallel mit der alten Access-Datenbank**. Das ist ein deutlich anderer Ausgangspunkt als reines Excel:
> - Die Disponenten sind **strukturierte Eingabemasken gewohnt** (Formulare, Felder, Buttons)
> - Es gibt bereits eine **Datenbank-Logik** (Patienten, Fahrer, Ziele als verknüpfte Tabellen)
> - Das Access-Frontend hat **gelernte Abläufe** — die Disponenten wissen genau, wo was ist
> - **Risiko:** Die neue App muss mindestens so schnell und vertraut sein wie das Access-Frontend, sonst bleibt Access das Primärsystem
>
> Die Doppelspurigkeit entsteht dadurch, dass Disponenten Fahrten **zuerst in Access erfassen** (weil vertraut und schnell) und dann später oder gar nicht in die neue App übertragen.
>
> **Positiv:** Die gesamte Access-DB wurde bereits in die FahrdienstApp importiert, inkl. mehrerer Jahre Fahrtendaten. Damit entfällt die Stammdaten-Hürde — alle Patienten, Fahrer und Ziele sind bereits in der neuen App verfügbar. Der Fokus liegt jetzt rein auf **UX-Parität**: Die App muss genauso schnell und vertraut bedienbar sein wie das Access-Frontend.

---

## Teil 1: IST-Zustand — Der echte Arbeitstag

### 1.1 Arbeitsbeginn (Morgens, ca. 06:30–07:00)

Der Disponent kommt ins Büro und startet seinen Tag. Sein erster Griff geht zum **Papier-Tagesblatt** oder zum **Access-Frontend**, das er am Abend zuvor vorbereitet hat.

**Was er als Erstes tut:**

- Prüft, welche **Serien-Fahrten** (z.B. Dialyse Mo/Mi/Fr) heute anstehen — diese sind evtl. schon vorgemerkt
- Schaut, ob es **Änderungen vom Vorabend** gibt (Absagen, Verschiebungen per Anrufbeantworter oder E-Mail)
- Verschafft sich eine Übersicht: Wie viele Fahrten heute? Welche Fahrer stehen zur Verfügung?

**Medien in Gebrauch:**

- **Access-Datenbank mit Frontend** (Hauptarbeitsinstrument / Altsystem)
- FahrdienstApp (teilweise parallel in Benutzung)
- Telefon (Festnetz, evtl. Handy)
- E-Mail (für Spitäler, Heime, Ärzte)
- Evtl. Notizzettel auf dem Schreibtisch für Schnellnotizen während Telefonaten

---

### 1.2 Auftragseingang (Laufend über den Tag)

Aufträge kommen auf verschiedenen Kanälen rein. Der Disponent muss sie alle zusammenführen.

#### Kanal 1: Telefon (Hauptkanal, ca. 70–80%)

Ein Spital, ein Altersheim oder ein Angehöriger ruft an:

- *"Herr Müller muss am Donnerstag zur Dialyse ins Kantonsspital, Abholung 07:15"*
- *"Frau Meier braucht morgen einen Rücktransport vom Spital, ca. 14:00"*

**Was der Disponent tut:**

1. Hört zu, notiert auf **Papier** oder gibt direkt in die **Access-DB** ein
2. Fragt nach: Patient, Abholort, Ziel, Uhrzeit, Besonderheiten (Rollstuhl? Begleitperson? Sauerstoff?)
3. Bestätigt mündlich: *"Ist eingetragen, Fahrer wird noch zugewiesen"*
4. Legt auf, wendet sich dem nächsten Anruf zu

**Problem:** Geübte Disponenten können während des Telefonats in Access erfassen — sie kennen die Masken auswendig. Die neue App muss **genauso schnell bedienbar** sein, sonst greifen sie zum Papier oder bleiben bei Access.

#### Kanal 2: E-Mail / Fax (ca. 15–20%)

Spitäler und grössere Institutionen senden Transportanfragen per E-Mail oder (vereinzelt noch) per Fax.

**Was der Disponent tut:**

1. Öffnet E-Mail / nimmt Fax entgegen
2. Überträgt die Daten in die Access-DB (oder die neue App)
3. Bestätigt per E-Mail oder Rückruf

#### Kanal 3: Serien / Wiederkehrende Fahrten (ca. 10–15%)

Regelmässige Fahrten (Dialyse 3x/Woche, Physiotherapie 2x/Woche) sind im System oft als wiederkehrende Einträge vorgemerkt.

**Was der Disponent tut:**

1. Prüft am Morgen, ob die Serien-Fahrten für heute/morgen korrekt erfasst sind
2. Ergänzt fehlende Einträge
3. Prüft, ob sich Zeiten oder Ziele geändert haben

---

### 1.3 Die Access-Datenbank (Altsystem & Kernproblem: Doppelspurigkeit)

Die Access-DB mit ihrem Frontend ist das **zentrale Arbeitsinstrument**. Sie hat eigene Eingabemasken, verknüpfte Tabellen und Reports/Auswertungen. Die Disponenten kennen dieses System seit Jahren.

#### Typische Tagesansicht (Ausgabe/Report):

| Uhrzeit | Patient | Von | Nach | Fahrer | Richtung | Bemerkungen | Status |
|---------|---------|-----|------|--------|----------|-------------|--------|
| 07:15 | Müller Hans | Wohlen | Kantonsspital AG | Peter | Hin | Rollstuhl | OK |
| 08:30 | Meier Anna | Altersheim Lind | Hausarzt Dr. Kern | — | Hin+Rück | Gehstock | offen |
| 14:00 | Meier Anna | Hausarzt Dr. Kern | Altersheim Lind | — | Rück | | offen |

#### Was der Disponent in Access tut:

1. **Erfassen:** Neue Fahrten über ein Formular eingeben (Felder für Patient, Ziel, Zeit etc.)
2. **Zuweisen:** Fahrer aus einer Dropdown-Liste wählen
3. **Status aktualisieren:** Status-Feld ändern (OK, offen, etc.)
4. **Änderungen:** Datensatz öffnen, Felder ändern, speichern
5. **Tagesübersicht:** Report/Abfrage für den aktuellen Tag aufrufen
6. **Abrechnung:** Access-Reports für die Buchhaltung generieren

#### Das Problem der Doppelspurigkeit:

Mit der neuen FahrdienstApp parallel entsteht folgender Ablauf:

1. Auftrag kommt rein → Disponent erfasst in **Access** (vertraut, schnell, gelernt)
2. Irgendwann überträgt er die Daten in die **FahrdienstApp** (2. Erfassung)
3. Evtl. Papiernotizen während hektischer Telefonphasen (3. Medium)
4. Ergebnis: **Doppel- bis Dreifach-Erfassung** (Papier → Access → App)

Das passiert, weil:

- Access **schneller und vertrauter** ist — der Disponent kennt jede Maske auswendig
- Die neue App seinen **gelernten Workflow** (noch) nicht 1:1 abbildet
- Access-Reports für Abrechnung und Tagesübersicht noch gebraucht werden
- Der Disponent der neuen App noch nicht vollständig **vertraut**

> **Wichtige Erkenntnis:** Der Gegner ist nicht Excel (das wäre einfach zu schlagen), sondern eine **funktionierende Access-Anwendung** mit eingespielten Abläufen. Die FahrdienstApp muss nicht nur "besser als Excel" sein, sondern **besser als ein System, das seit Jahren funktioniert**.

---

### 1.4 Fahrer-Zuweisung (Kernaufgabe)

Der Disponent kennt seine Fahrer persönlich. Er weiss aus Erfahrung:

- Wer ist heute verfügbar (er hat eine mentale Karte, evtl. eine Access-Abfrage, oder eine handschriftliche Liste)
- Wer fährt gerne welche Route
- Wer kann Rollstuhltransporte machen (Fahrzeug-Typ)
- Wer ist zuverlässig, wer braucht mehr Vorlaufzeit

**Zuweisungs-Workflow:**

1. Schaut sich die ungeplanten Fahrten an (in Access: Abfrage/Report ohne Fahrer-Zuweisung)
2. Überlegt: Welcher Fahrer passt? Ist er frei? Liegt die Route günstig?
3. **Ruft den Fahrer an** (Telefon!) oder schickt eine E-Mail
4. Fahrer bestätigt mündlich oder per E-Mail → Disponent trägt den Namen in Access ein
5. Bei Ablehnung: nächsten Fahrer anrufen

**Hinweis:** Die E-Mail-basierte Accept/Reject-Funktion der FahrdienstApp ist hier ein grosser Fortschritt — aber nur, wenn der Disponent sie auch nutzt und nicht parallel weiter anruft.

---

### 1.5 Tages-Monitoring (Laufend)

Der Disponent überwacht den Fortschritt über den Tag:

- **Telefon-Rückmeldungen:** Fahrer rufen an — *"Bin beim Patienten"*, *"Fahrt abgeschlossen"*
- **Probleme:** *"Patient nicht da"*, *"Adresse stimmt nicht"*, *"Stau, komme 20 Min. später"*
- **In Access:** Ändert den Status manuell ("unterwegs", "erledigt", "Problem")

**Kein Echtzeit-Tracking:** Der Disponent hat keinen Live-Überblick. Er ist abhängig davon, dass Fahrer ihn aktiv informieren.

---

### 1.6 Tagesabschluss (Abends, ca. 17:00–18:00)

Der Disponent schliesst den Tag ab:

1. Alle Fahrten in Access durchgehen: Sind alle erledigt?
2. Nicht-durchgeführte Fahrten markieren (No-Show, Storno)
3. **Abrechnungsdaten** per Access-Report zusammenstellen (für Krankenkassen, Institutionen, interne Buchhaltung)
4. Nächsten Tag vorbereiten: Prüfen ob Serien-Fahrten für morgen korrekt erfasst sind
5. **Im Parallelbetrieb:** Offene Daten von Access in die FahrdienstApp übertragen

---

### 1.7 Kommunikation mit Fahrern

Die Kommunikation läuft über zwei Hauptkanäle:

- **Telefon** (Hauptkanal) — Fahrer rufen an, Disponent ruft an. Für dringende Sachen und Problemfälle.
- **E-Mail** (zweiter Kanal) — Für Fahrtzuweisungen, Auftragsdetails und den Accept/Reject-Flow der App. Fahrer sind E-Mail-fähig.

**Der Disponent ist die zentrale Drehscheibe.** Alles läuft über ihn. Fahrer haben untereinander wenig Koordination.

> **Wichtig für die App-Strategie:** Da Fahrer bereits E-Mail nutzen, ist der Token-basierte Accept/Reject-Flow (M7/M10) ein realistischer Kanal. Die E-Mail muss aber so klar und einfach sein, dass kein zusätzlicher Anruf nötig ist.

---

## Teil 2: Schmerzpunkte & Doppelspurigkeiten

### 2.1 Identifizierte Doppelspurigkeiten

| # | Doppelspurigkeit | Wo | Auswirkung |
|---|-----------------|-----|------------|
| D1 | Papier → Access → neue App (Doppel-/Dreifach-Erfassung) | Auftragseingang | Zeitverlust, Fehlerquelle, Frust |
| D2 | Fahrer-Anruf/E-Mail + manueller Access-Eintrag | Fahrer-Zuweisung | Vergessene Zuweisungen, kein Nachweis |
| D3 | Status-Updates per Telefon + manueller Access-Eintrag | Monitoring | Veraltete Übersicht, Reaktionsverzögerung |
| D4 | Serien-Fahrten manuell kopieren (Tag für Tag) | Tagesvorbereitung | Vergessene Serien, falsche Daten |
| D5 | Abrechnungsdaten per Access-Report + evtl. manuelle Nacharbeit | Tagesabschluss | Fehlerhafte Abrechnungen, Abhängigkeit vom Access-System |
| D6 | Kontaktdaten in Access + evtl. neue App + evtl. Adressbuch | Stammdaten | Inkonsistente Daten, divergierende Systeme |

### 2.2 Medienbrüche

| Übergang | Beschreibung |
|----------|-------------|
| Telefon → Papier | Auftrag wird mitgeschrieben |
| Papier → Access | Aufträge werden übertragen |
| Access → neue App | Im Parallelbetrieb, oft am Tagesende |
| Telefon → Access | Fahrer-Rückmeldungen manuell einpflegen |
| Access → Abrechnung | Reports für Buchhaltung generieren |

### 2.3 Risiken des aktuellen Workflows

- **Datenverlust:** Notizzettel gehen verloren, Access-DB evtl. nicht regelmässig gesichert
- **Fehlerhafte Übertragung:** Falsche Uhrzeit, falscher Patient, falsches Ziel
- **Keine Nachvollziehbarkeit:** Wer hat wann was geändert? Kein Audit-Trail
- **Keine Echtzeit-Übersicht:** Disponent weiss nicht, wo seine Fahrer gerade sind
- **Personenabhängigkeit:** Alles Wissen steckt im Kopf des Disponenten

---

## Teil 3: SOLL-Konzept — Doppelspurigkeiten eliminieren

### 3.1 Leitprinzipien für die FahrdienstApp

> **Goldene Regel:** Die App muss die Access-DB **vollständig ablösen**. Wenn der Disponent weiterhin Access öffnen muss, haben wir versagt. Das ist schwieriger als Excel abzulösen, weil Access bereits ein strukturiertes System mit gelernten Abläufen ist.

Prinzipien für Disponenten 60+:

1. **Weniger Klicks, nicht mehr Features** — Jede Aktion so schnell wie in Access
2. **Vertraute Metaphern** — Tagesansicht = "Wie meine Access-Maske, aber besser"
3. **Kein Zwang zum Umlernen** — Der Workflow bleibt gleich, das Medium ändert sich
4. **Fehlertoleranz** — Alles rückgängig machbar, nichts wird gelöscht
5. **Grosse Schrift, klare Kontraste** — Kein Designpreis, sondern Lesbarkeit
6. **Sofort-Feedback** — Jede Aktion hat eine sichtbare Bestätigung
7. **Offline-fähig denken** — Auch bei langsamem Internet nutzbar

### 3.2 Lösung pro Doppelspurigkeit

#### D1: Dreifach-Erfassung eliminieren → Direkteingabe während Telefonat

**Problem:** Papier → Access → neue App

**Lösung: "Schnellerfassung" direkt in der App**

- Ein **Schnellerfassungs-Formular** das während des Telefonats bedienbar ist
- Maximal 4 Felder sichtbar: Patient (Autocomplete), Ziel (Autocomplete), Datum+Zeit, Richtung
- **Tastatur-optimiert:** Tab-Reihenfolge stimmt, Enter = Speichern
- **Autocomplete mit Fuzzy-Search:** "Mül" findet "Müller Hans" — kein Dropdown-Scrollen
- Fahrer-Zuweisung ist **optional** und kann später erfolgen
- Ergebnis: **1 Erfassung statt 3**

**UI-Anforderung:**

- Immer sichtbarer "+ Neue Fahrt"-Button (gross, auffällig)
- Formular öffnet sich inline oder als Modal — kein Seitenwechsel
- Patient und Ziel haben je ein Suchfeld mit sofortigem Autocomplete
- "Zuletzt verwendet" Liste für häufige Patienten/Ziele
- Speichern-Button gross und eindeutig

#### D2: Mündliche Zuweisung ersetzen → Digitaler Fahrer-Accept-Flow

**Problem:** Anruf + manueller Access-Eintrag

**Lösung: Zuweisung in der App → automatische E-Mail an Fahrer**

- Disponent wählt Fahrer im Dropdown → App sendet automatisch E-Mail
- Fahrer klickt Accept/Reject → Status aktualisiert sich in der App
- **Kein Anruf mehr nötig** (ausser bei dringenden Fällen)
- Dashboard zeigt sofort: Wer hat bestätigt? Wer hat abgelehnt? Wer hat noch nicht reagiert?

**Bereits umgesetzt:** Token-basierter E-Mail-Flow (M7/M10). Muss aber so einfach sein, dass der Disponent es dem Telefonat **vorzieht**.

#### D3: Manuelle Status-Updates eliminieren → Fahrer-Self-Service

**Problem:** Fahrer ruft an, Disponent tippt in Access

**Lösung: Fahrer aktualisieren Status selbst (Mobile)**

- Fahrer haben eine einfache Mobile-Ansicht: "Meine Fahrten heute"
- Ein Knopf pro Status-Übergang: "Unterwegs" → "Abgeholt" → "Angekommen" → "Fertig"
- Disponent sieht Updates **in Echtzeit** auf seinem Dashboard
- Telefonate nur noch bei Problemen, nicht für Routine-Updates

**Noch nicht umgesetzt:** Fahrer-Profilpflege und rollenbasierte Navigation sind offene Issues.

#### D4: Serien manuell kopieren → Automatische Serien-Generierung

**Problem:** Serien-Fahrten werden Tag für Tag von Hand kopiert

**Lösung: Serien-Fahrten mit automatischer Generierung**

- Disponent legt eine Serie an: "Müller Hans, Dialyse, Mo/Mi/Fr, 07:15, bis Ende Juni"
- App generiert automatisch alle Einzelfahrten
- Änderungen an der Serie propagieren zu zukünftigen Fahrten
- Einzelne Fahrten können trotzdem individuell angepasst werden

**Bereits teilweise umgesetzt:** Serien-Toggle in M9, aber die automatische Generierung und Propagierung muss noch ausgebaut werden.

#### D5: Abrechnung aus Access → Automatischer Billing-Export

**Problem:** Abrechnungsdaten werden per Access-Report zusammengesucht

**Lösung: Automatische Kostenberechnung + Export**

- Jede abgeschlossene Fahrt hat automatisch berechnete Kosten (PLZ-Zone × Distanz × Tarif)
- Ein-Klick-Export: "Abrechnung für März 2026" → CSV/PDF
- Gruppierung nach Kostenträger (Krankenkasse, Privatpatient, Institution)

**Bereits teilweise umgesetzt:** Tarifmatrix und PLZ-Zonen aus M8.

#### D6: Stammdaten-Chaos → Zentrale Datenbank

**Problem:** Kontaktdaten verstreut in Access, Adressbuch, neue App

**Lösung: App ist die Single Source of Truth**

- Alle Patienten, Ziele und Fahrer werden **nur in der App** gepflegt
- Autocomplete beim Erfassen zieht aus der Datenbank
- Beim Erstauftrag: Patient/Ziel direkt inline anlegen (kein Seitenwechsel)

**Bereits umgesetzt:** CRUD für alle Stammdaten (M1). Inline-Anlage aus M9.

---

## Teil 4: UX-Anforderungen für Disponenten 60+

### 4.1 Visuelle Anforderungen

| Kriterium | Minimum | Begründung |
|-----------|---------|------------|
| Schriftgrösse Tabellen | 14px | Lesbarkeit ohne Lesebrille |
| Schriftgrösse Buttons/Labels | 16px | Eindeutig erkennbar |
| Farbkontrast | WCAG AAA (7:1) | Altersbedingte Sehschwäche |
| Klickflächen (Buttons) | Min. 48×48px | Motorische Präzision nimmt ab |
| Zeilenabstand Tabellen | Min. 44px | Zeile nicht versehentlich verfehlen |
| Icon-Begleitung | Immer mit Text-Label | Icons allein sind mehrdeutig |

### 4.2 Interaktions-Anforderungen

| Kriterium | Anforderung | Begründung |
|-----------|-------------|------------|
| Tastatur-Navigation | Tab-Reihenfolge logisch | Schnellerfassung ohne Maus |
| Bestätigungs-Dialoge | Bei destruktiven Aktionen | Versehentliches Löschen verhindern |
| Undo / Rückgängig | Für letzte Aktion | Sicherheitsnetz |
| Autosave | Bei jedem Feld-Verlassen | Kein Datenverlust bei Browser-Crash |
| Ladezeiten | Max. 2 Sekunden | Geduld ist endlich, Access ist sofort |
| Fehlermeldungen | Deutsch, verständlich, mit Lösung | *"Bitte wählen Sie einen Patienten"* statt *"patient_id required"* |

### 4.3 Workflow-Anforderungen

| Kriterium | Anforderung | Begründung |
|-----------|-------------|------------|
| Tagesansicht als Startseite | Standard-View = Heute | Entspricht dem Access-Denken |
| Max. 2 Klicks zu jeder Aktion | Neue Fahrt, Fahrer zuweisen, Status ändern | Effizienz |
| Kein Seitenwechsel beim Erfassen | Inline-Formulare oder Modals | Kontext nicht verlieren |
| Drag & Drop: Optional, nie Pflicht | Alle Aktionen auch per Klick/Tastatur | Nicht jeder kann Drag & Drop |
| Druckansicht | Tagesplan als PDF druckbar | Backup-Gefühl, Gewohnheit |

---

## Teil 5: Migrationsstrategie — Vom Parallelbetrieb zum Vollbetrieb

### 5.1 Das Problem des Parallelbetriebs

Der aktuelle Zustand (Access-DB + neue App parallel) ist der **schlechteste aller Zustände**:

- Disponent muss alles doppelt pflegen → mehr Arbeit als vorher
- Daten divergieren → Access und App zeigen unterschiedliche Stände
- Vertrauen in die neue App sinkt → "In Access stimmt es, in der App nicht"
- Access-Reports für Abrechnung werden weiterhin gebraucht → Access bleibt unverzichtbar
- Fazit: Der Parallelbetrieb **bestätigt dem Disponenten, dass er Access braucht**

> **Besonderes Risiko bei Access-Ablösung:** Anders als bei Excel hat Access eine echte Datenbankstruktur. Die Disponenten haben damit **strukturierte Workflows gelernt** (Formulare, Dropdowns, Reports). Die neue App konkurriert nicht mit einem chaotischen Workaround, sondern mit einem **funktionierenden System**.

### 5.2 Migrationsphasen

#### Phase 1: "Die App kann alles, was Access kann" (Voraussetzung — Parität)

Die App muss **mindestens gleichwertig** zum Access-Frontend sein:

- [ ] Tagesansicht die sich so vertraut anfühlt wie die Access-Maske
- [ ] Schnellerfassung während Telefonat (gleich schnell wie Access-Formular)
- [ ] Druckbare Tagesübersicht (PDF) → ersetzt den Access-Tagesreport
- [ ] Alle Serien-Fahrten automatisch generiert
- [ ] Fahrer-Zuweisung per Dropdown + automatische E-Mail
- [ ] **Abrechnungs-Report** der den Access-Report ersetzt (kritisch für Ablösung!)
- [x] ~~**Daten-Migration:** Bestehende Patienten, Fahrer, Ziele und historische Fahrten aus Access importieren~~ ✅ Bereits erledigt! Die gesamte Access-DB inkl. mehrerer Jahre Fahrtendaten wurde bereits in die FahrdienstApp (Supabase) importiert.

#### Phase 2: "Die App kann mehr als Access" (Motivation zum Wechsel)

Die App bietet Vorteile, die Access nicht hat:

- [ ] Automatische Fahrer-Bestätigung (kein Anruf nötig)
- [ ] Echtzeit-Status von Fahrern (kein Anruf nötig)
- [ ] Automatische Kostenberechnung
- [ ] Ein-Klick-Abrechnung statt manueller Access-Report
- [ ] Historiensuche: "Alle Fahrten von Müller Hans in den letzten 3 Monaten"

#### Phase 3: "Access abschalten" (Ziel)

- [ ] Disponent arbeitet einen ganzen Tag nur in der neuen App
- [ ] Begleitete Testphase: 1 Woche nur App, Access als "Notfall-Backup" noch offen
- [ ] Abrechnungs-Reports laufen vollständig über die neue App
- [ ] Nach 2–4 Wochen: Access-DB archivieren (Read-Only für historische Daten), nicht mehr aktiv nutzen
- [ ] Druckbare Tagesübersicht bleibt als Übergangshilfe

### 5.3 Erfolgsmessung

| Metrik | Ziel | Messung |
|--------|------|---------|
| Access-Öffnungen pro Tag | 0 | Disponent beobachten / fragen |
| Fahrten nur in App erfasst | 100% | DB-Vergleich mit Access |
| Papiernotizen während Telefonat | 0 | Disponent beobachten |
| Fahrer-Anrufe für Routine-Zuweisung | 0 | Disponent fragen |
| Zeit für Tagesabschluss | < 10 Min. | Vorher/Nachher |

---

## Teil 6: Nächste Schritte

- [ ] **Schnellerfassungs-Formular** als Prototyp bauen (höchste Prio — Schlüssel zu Phase 1)
- [ ] **Tagesansicht** so umbauen, dass sie dem Access-Frontend ebenbürtig ist
- [x] ~~**Daten-Migration** aus Access~~ ✅ Bereits erledigt — gesamte Access-DB inkl. mehrerer Jahre Fahrtendaten importiert
- [ ] **Abrechnungs-Report** implementieren (ersetzt Access-Report — Blocker für Ablösung)
- [ ] **Druckbare Tagesübersicht** als PDF implementieren
- [ ] Workflow mit einem echten Disponenten validieren (Shadowing-Session)
- [ ] Fahrer-Mobile-View konzipieren (Phase 2)
- [ ] Onboarding-Konzept für Disponenten (1:1 Begleitung, nicht Schulungsunterlagen)

---

> **Kernfrage für jedes Feature:** *Würde der Disponent dafür sein Access aufgeben?* Wenn nein → Feature ist noch nicht gut genug.