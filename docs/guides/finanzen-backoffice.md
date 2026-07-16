# Anleitung Finanzen (Backoffice)

Diese Anleitung richtet sich an das Backoffice (Operator und Administration). Sie zeigt, wie Sie im Bereich **Finanzen** Quittungen ausstellen, den Fahrer-Report nutzen und die Auswertungen lesen. Schritt für Schritt, mit den konkreten Klickpfaden.

Den Bereich öffnen Sie oben im Menü unter **Finanzen**. Er hat fünf Unterseiten:

- **Dashboard** (`/finance`) – Überblick über Umsatz, Fahrten und km
- **Quittungen** (`/finance/receipts`) – Belege erstellen, herunterladen, versenden, stornieren
- **Fahrer** (`/finance/drivers`) – Leistung, Einnahmen und Entschädigung pro Fahrer
- **Statistik** (`/finance/statistics`) – flexible Auswertungen über Fahrten, km und Umsatz
- **Export** (`/finance/export`) – die frühere „Verrechnung“ (CSV-Export der Fahrten)

> **Gut zu wissen:** Der frühere Menüpunkt „Verrechnung“ heisst jetzt „Finanzen“. Alte Lesezeichen auf `/billing` funktionieren weiter – sie leiten automatisch auf **Finanzen → Export**.

---

## 1. Was ist eine Quittung?

Eine Quittung ist eine **Zahlungsbestätigung** für einen Patienten – zum Beispiel zum Einreichen bei der Krankenkasse. Sie ist **keine Rechnung**: Die Patienten zahlen bar oder per Twint direkt beim Fahrer, die Quittung bestätigt nur den bereits erhaltenen Betrag.

Wichtige Eigenschaften:

- Jede Quittung hat eine **fortlaufende Nummer** im Format `Q-2026-00042` (pro Jahr neu ab 00001).
- Eine ausgestellte Quittung ist **unveränderlich**. Ein Fehler wird nicht korrigiert, sondern **storniert** und neu ausgestellt.
- Quittierbar sind nur **abgeschlossene** Fahrten. Fahrten ohne Preis müssen zuerst gepflegt werden.
- Jede abgeschlossene Fahrt darf in **höchstens einer aktiven Quittung** stehen. Nach einem Storno wird die Fahrt wieder quittierbar.

---

## 2. Eine Einzelquittung erstellen

Für einen Patienten und einen Zeitraum.

1. Öffnen Sie **Finanzen → Quittungen**.
2. Klicken Sie oben rechts auf **Neue Quittung**.
3. Wählen Sie bei **Patient** die Person (Suchfeld: Name eintippen).
4. Wählen Sie den **Zeitraum**: Schnellwahl **Diese Woche** oder **Dieser Monat**, oder tragen Sie **Von** und **Bis** von Hand ein.
5. Darunter erscheinen alle **quittierbaren Fahrten** des Zeitraums mit Datum, Route, km und Betrag. Sie können einzelne Fahrten **abwählen**. Die Summe wird laufend angezeigt.
6. Klicken Sie auf **Quittung ausstellen**.

Die App zieht die nächste Nummer, friert die Daten ein und erzeugt das PDF.

> **Wichtig:** Fahrten **ohne Preis** sind nicht auswählbar und werden als „ohne Preis“ markiert. Ergänzen Sie den Preis vorher in der Fahrt (Formular unter „Tarif“), sonst fehlt die Fahrt auf der Quittung.

**Alternativer Einstieg:** Im **Patientendetail** gibt es den Abschnitt „Fahrten & Quittungen“ mit einem Button **Quittung erstellen** – dann sind Patient und Zeitraum bereits vorausgefüllt.

![TODO Screenshot: Formular „Neue Quittung“ mit Patient, Zeitraum und Fahrtenliste](platzhalter-finanzen-01-neue-quittung.png)

---

## 3. Quittung herunterladen oder per E-Mail senden

In der Liste **Finanzen → Quittungen** haben Sie pro Beleg diese Aktionen:

- **PDF herunterladen** – lädt immer dasselbe archivierte PDF.
- **Per E-Mail senden** – schickt das PDF an den Patienten.

**Voraussetzung für den E-Mail-Versand:** Beim Patienten muss eine **E-Mail-Adresse** hinterlegt sein. Fehlt sie, ist der Button deaktiviert. Tragen Sie die E-Mail im Patientendetail nach.

> **Steht „kein PDF“ bei einer Quittung?** Dann ist die PDF-Erzeugung beim Ausstellen fehlgeschlagen (z. B. Speicher kurz nicht erreichbar). Der Beleg ist trotzdem gültig – Sie können das PDF über die Aktion neu erzeugen. Der Inhalt bleibt identisch, weil die Daten eingefroren sind.

![TODO Screenshot: Quittungsliste mit den Aktionen PDF, E-Mail und Stornieren](platzhalter-finanzen-02-quittungsliste.png)

---

## 4. Sammellauf (mehrere Patienten auf einmal)

Für den Monatsabschluss: pro Patient eine Quittung, plus ein zusammengefügtes Sammel-PDF zum Ausdrucken.

1. Öffnen Sie **Finanzen → Quittungen** und klicken Sie auf **Sammellauf**.
2. Wählen Sie den **Zeitraum** (meist der abgelaufene Monat).
3. Die App zeigt **alle Patienten** mit quittierbaren Fahrten im Zeitraum samt Summe. Sie können einzelne Patienten abwählen.
4. Klicken Sie auf **Sammellauf starten** und bestätigen Sie.

Ergebnis: Pro Patient wird eine eigene Quittung (mit eigener Nummer) erstellt. Anschliessend erhalten Sie **ein mehrseitiges Sammel-PDF** (eine Seite pro Quittung) zum Herunterladen und Ausdrucken. Patienten mit E-Mail-Adresse können direkt per Mail bedient werden.

> **Gut zu wissen:** Schlägt bei einem einzelnen Patienten etwas fehl, läuft der Rest trotzdem durch. Im Ergebnis sehen Sie, welche Belege ausgestellt wurden und wo es ein Problem gab.

![TODO Screenshot: Sammellauf mit Patientenliste und Button „Sammellauf starten“](platzhalter-finanzen-03-sammellauf.png)

---

## 5. Eine Quittung stornieren

Storno wird benötigt, wenn ein Beleg falsch ist (falscher Zeitraum, falsche Fahrt, doppelt erstellt).

1. Suchen Sie den Beleg in **Finanzen → Quittungen**.
2. Klicken Sie beim Beleg auf **Stornieren**.
3. Geben Sie eine **Begründung** ein (Pflichtfeld, mindestens 3 Zeichen).
4. Bestätigen Sie.

Was passiert:

- Der Status der Quittung wechselt auf **storniert**; das PDF bleibt archiviert (mit Storno-Kennzeichnung in der Liste).
- Die zugehörigen **Fahrten werden wieder quittierbar** – Sie können sie danach in eine neue, korrekte Quittung aufnehmen.
- Der Vorgang wird protokolliert (Audit-Trail).

> **Wichtig:** Es gibt keinen separaten Storno-Gegenbeleg – der Storno-Vermerk mit Begründung genügt. Korrektur heisst immer: **stornieren, dann neu ausstellen.**

---

## 6. Fahrer-Report und Entschädigungssätze

Der Fahrer-Report unter **Finanzen → Fahrer** zeigt pro Fahrer und Zeitraum:

- **Fahrten** (Anzahl abgeschlossen), **km**, **Einsatzzeit**
- **Einnahmen** (Bareinkasso = Umsatz, für den Kassenabgleich)
- **Entschädigung** (CHF)

Klick auf einen Fahrer öffnet die Einzelfahrten des Zeitraums (Drill-down). Über den Export-Button laden Sie die Tabelle als CSV für die Vereinsbuchhaltung.

### Entschädigungssätze einstellen

Die Entschädigung wird **live** berechnet: `Anzahl Fahrten × Pauschale + km × km-Satz`. Die Sätze pflegen Sie zentral:

1. Öffnen Sie **Einstellungen → Organisation** (`/settings/organization`). *(nur Administration)*
2. Im Abschnitt **Fahrer-Entschädigung** tragen Sie ein:
   - **Pauschale pro Fahrt (CHF)** – z. B. `5.00`
   - **km-Satz (CHF)** – z. B. `0.70`
3. Speichern.

> **Wichtig:** Die Sätze sind **nicht** pro Zeitraum versioniert. Ändern Sie einen Satz, ändert sich die Entschädigung **rückwirkend** in allen Reports. Passen Sie die Sätze also erst an, nachdem ein Zeitraum ausgezahlt ist. Ein leeres Feld bedeutet „kein Satz“ (CHF 0).

![TODO Screenshot: Abschnitt „Fahrer-Entschädigung“ in den Organisations-Einstellungen](platzhalter-finanzen-04-entschaedigung.png)

---

## 7. Dashboard und Statistik

### Dashboard (`/finance`)

Der Überblick für den laufenden Monat: **Umsatz**, **Fahrten**, **gefahrene km** und **Ø Preis pro Fahrt** – jeweils mit Vergleich zum Vormonat und zum Vorjahresmonat. Dazu Verlaufscharts über 12 Monate, Top-Listen (häufigste Ziele, aktivste Fahrer, Patienten nach Fahrtenzahl) und ein Quittungs-Widget mit den zuletzt ausgestellten Belegen sowie der Anzahl noch offener, quittierbarer Fahrten.

> **Gut zu wissen:** In einem noch leeren Zeitraum (z. B. Monatsanfang ohne Vergleichsdaten) steht bei den Veränderungen ein **„—“** statt einer Prozentzahl. Das ist kein Fehler, sondern bedeutet „kein Vergleich möglich“.

### Statistik (`/finance/statistics`)

Flexible Auswertung nach **Dimension** (Zeit, Fahrer, Ziel, Zone, Patient, Richtung) × **Kennzahl** (Fahrten, km, Fahrzeit, Umsatz). Die Jahresansicht beantwortet direkt Fragen wie „Wie viele km sind wir letztes Jahr insgesamt gefahren?“. Jede Auswertung lässt sich als CSV exportieren.

### km-Nachberechnung erkennen

Nicht jede km-Angabe stammt aus der ursprünglichen Planung. Distanzen, die nachträglich ermittelt wurden (Backfill/Schätzung), werden gesondert ausgewiesen:

- In der Statistik-Tabelle gibt es die Spalte **„davon nachber.“** (davon nachberechnet).
- Ist dieser Wert grösser als null, wird er **farblich hervorgehoben** – so sehen Sie auf einen Blick, welcher km-Anteil nicht aus der Planung stammt.
- Fahrten ganz ohne Distanz werden separat als „Fahrten ohne km“ gezählt und fliessen nicht in die km-Summe ein.

> **Warum das wichtig ist:** Bei Auswertungen, die auf km beruhen (z. B. Entschädigung, Gesamtkilometer), zeigt Ihnen der nachberechnete Anteil, wie belastbar die Zahl ist.

![TODO Screenshot: Statistik-Tabelle mit hervorgehobener Spalte „davon nachber.“](platzhalter-finanzen-05-statistik.png)

---

## Sie kommen nicht weiter?

- In der App gibt es unter **Hilfe** ([/hilfe](/hilfe)) weitere Anleitungen.
- Bei fehlenden Preisen oder km: die betreffende Fahrt öffnen und die Angaben ergänzen, dann die Quittung neu erstellen.
