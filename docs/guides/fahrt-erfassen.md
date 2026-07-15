# Fahrt erfassen (One-Page-Dispo)

Diese Kurzanleitung richtet sich an Disponentinnen und Disponenten. Sie zeigt,
wie Sie auf der Seite **Fahrt erfassen** eine neue Fahrt anlegen — links
eingeben, rechts sofort das Ergebnis sehen.

Die Seite erreichen Sie unter **Fahrten → Fahrt erfassen**
([`/rides/erfassen`](/rides/erfassen)) oder direkt aus dem Dashboard.

Architektur- und Design-Hintergrund: siehe
[ADR-014](../adrs/014-fahrt-erfassung.md).

---

## Das Prinzip: links erfassen, rechts live sehen

Die Seite hat zwei Spalten:

- **Links** geben Sie ein: **Wer** fährt **wohin** und **wann** ist der Termin.
- **Rechts** erscheint sofort das Ergebnis: Karte, berechnete Abholzeit(en) und
  der Preis. Sie müssen dafür nichts speichern — die rechte Spalte rechnet bei
  jeder Änderung mit.

---

## Schritt für Schritt

1. **Wer:** Patient auswählen. Ist die Person noch nicht erfasst, legen Sie sie
   direkt hier an. Der **Kostenträger** (z. B. Krankenkasse, Gemeinde) wird zum
   Patienten angezeigt — er wird beim Patienten gepflegt, nicht bei der Fahrt.
2. **Wohin:** Ziel auswählen. Sobald Patient und Ziel stehen, berechnet die App
   automatisch die **Route** und zeigt sie rechts auf der Karte.
3. **Wann:** **Terminbeginn** und **Termindauer** eingeben. Daraus leitet die
   App ab:
   - **Abholzeit Hinfahrt** = Terminbeginn − Fahrzeit − Vorlauf − Einsteigezeit
   - **Terminende** = Terminbeginn + Termindauer
   - **Abholzeit Rückfahrt** = Terminende + Puffer
   Die vorgeschlagene Abholzeit können Sie jederzeit **manuell überschreiben**.
4. **Hin & Rück:** Standardmäßig wird eine **Hin- und eine Rückfahrt** angelegt
   (zwei verknüpfte Fahrten). Für eine reine Einzelfahrt stellen Sie auf
   **Einzelfahrt** um.
5. **Bedarf:** Transportbedarf als Chips wählen (Rollstuhl, Rollator, Begleitung,
   Sauerstoff, Tragestuhl, Trage). Rollstuhl bestimmt den Fahrzeugtyp; die
   übrigen sind informative Hinweise für die Fahrerin oder den Fahrer.
6. **Speichern:** Zwei Möglichkeiten:
   - **Speichern & zur Übersicht** — legt die Fahrt an und springt zur
     Tagesansicht.
   - **Auftragsblatt** — legt die Fahrt an und öffnet das Auftragsblatt, ohne
     wegzuspringen.

---

## Wichtig: Speichern wird nie blockiert

Sie können **jederzeit speichern**, auch wenn noch etwas fehlt. Die App
verhindert das Speichern nie wegen fehlender Geodaten, fehlendem Preis oder
fehlender Terminzeit. Stattdessen erscheint nach dem Speichern ein Hinweis, z. B.:

- „Die Patientenadresse ist noch nicht geocodiert.“ → Route/Preis konnten nicht
  berechnet werden.
- „Der Preis konnte nicht automatisch berechnet werden.“ → später prüfen oder
  manuell erfassen.
- „Es ist kein Terminbeginn erfasst.“ → keine Abholzeit-Vorschläge möglich.

Das Motto lautet: **jetzt erfassen, später ergänzen.** Die Fahrt ist gespeichert
und im Dispo-Board sichtbar; die Hinweise können Sie in Ruhe abarbeiten.

---

## Was diese Seite bewusst nicht macht

- **Keine Fahrerzuweisung.** Neu erfasste Fahrten sind zunächst „ungeplant“. Die
  Fahrerin oder den Fahrer weisen Sie anschließend im **Dispo-Board** zu. So
  bleibt das Erfassen schlank und das Disponieren an einem Ort.
- **Kein Bearbeiten.** Bestehende Fahrten ändern Sie weiterhin über das
  Fahrt-Bearbeiten-Formular, nicht hier.

---

## Verwandte Einstellungen

Die Puffer für die Zeitberechnung (Vorlauf, Einsteigezeit, Rückfahrt-Puffer)
sind organisationsweite Vorgaben und werden unter **Einstellungen** gepflegt.
Sie gelten als Startwert für den Vorschlag und können pro Fahrt überschrieben
werden.
