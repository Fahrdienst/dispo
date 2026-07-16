import type { HelpArticle } from "@/lib/help/types"

/**
 * Article "Finanzen: Quittungen, Reports und Auswertungen" — real content.
 * Audience: operator and admin.
 *
 * The slug stays "abrechnung" for bookmark/search continuity, but the content
 * now covers the whole Finanzen area (M14): the former "Verrechnung" export
 * moved under Finanzen → Export, joined by receipts, the driver report and the
 * dashboard/statistics. A dedicated deep guide for the backoffice lives at
 * docs/guides/finanzen-backoffice.md.
 */
export const abrechnung: HelpArticle = {
  slug: "abrechnung",
  title: "Finanzen: Quittungen, Reports und Auswertungen",
  category: "abrechnung",
  audience: ["operator", "admin"],
  keywords: [
    "finanzen",
    "abrechnung",
    "verrechnung",
    "quittung",
    "beleg",
    "zahlungsbestätigung",
    "sammellauf",
    "storno",
    "stornieren",
    "fahrer-report",
    "entschädigung",
    "dashboard",
    "statistik",
    "umsatz",
    "kilometer",
    "export",
    "csv",
  ],
  summary:
    "Im Bereich „Finanzen“ stellen Sie Quittungen aus, sehen den Fahrer-Report und werten Umsatz, Fahrten und Kilometer aus.",
  sections: [
    {
      id: "ueberblick",
      heading: "Der Bereich „Finanzen“",
      blocks: [
        {
          type: "paragraph",
          text: "Alles rund ums Geld finden Sie oben im Menü unter „Finanzen“. Der frühere Menüpunkt „Verrechnung“ ist darin aufgegangen – alte Lesezeichen funktionieren weiter und leiten automatisch auf „Finanzen → Export“.",
        },
        {
          type: "list",
          items: [
            "Dashboard: Überblick über Umsatz, Fahrten und Kilometer,",
            "Quittungen: Belege erstellen, herunterladen, versenden, stornieren,",
            "Fahrer: Leistung, Einnahmen und Entschädigung pro Fahrer,",
            "Statistik: flexible Auswertungen über Fahrten, km und Umsatz,",
            "Export: die frühere Verrechnung – alle Fahrten eines Zeitraums als CSV-Datei.",
          ],
        },
        {
          type: "callout",
          variant: "info",
          title: "Was ist eine Quittung?",
          text: "Eine Quittung ist eine Zahlungsbestätigung für den Patienten (z. B. für die Krankenkasse) – keine Rechnung. Die Patienten zahlen bar oder per Twint beim Fahrer; die Quittung bestätigt nur den erhaltenen Betrag.",
        },
      ],
    },
    {
      id: "quittung-erstellen",
      heading: "Eine Einzelquittung erstellen",
      blocks: [
        {
          type: "steps",
          steps: [
            {
              title: "Bereich „Quittungen“ öffnen",
              text: "Klicken Sie auf „Finanzen“ und dann auf „Quittungen“. Oben rechts wählen Sie „Neue Quittung“.",
            },
            {
              title: "Patient und Zeitraum wählen",
              text: "Wählen Sie den Patienten und den Zeitraum – per Schnellwahl „Diese Woche“ / „Dieser Monat“ oder mit „Von“ und „Bis“.",
            },
            {
              title: "Fahrten prüfen",
              text: "Darunter erscheinen alle quittierbaren Fahrten mit Datum, Route, km und Betrag. Sie können einzelne Fahrten abwählen; die Summe wird laufend angezeigt.",
            },
            {
              title: "Ausstellen",
              text: "Klicken Sie auf „Quittung ausstellen“. Die App vergibt eine fortlaufende Nummer (z. B. Q-2026-00042) und erzeugt das PDF.",
            },
          ],
        },
        {
          type: "callout",
          variant: "warning",
          title: "Fahrten ohne Preis",
          text: "Fahrten ohne Preis sind nicht auswählbar und als „ohne Preis“ markiert. Ergänzen Sie den Preis zuerst in der Fahrt (Formular unter „Tarif“), sonst fehlt die Fahrt auf der Quittung.",
        },
        {
          type: "callout",
          variant: "tip",
          text: "Schneller geht es aus dem Patientendetail: Der Abschnitt „Fahrten & Quittungen“ hat einen Button „Quittung erstellen“ – Patient und Zeitraum sind dann schon vorausgefüllt.",
        },
      ],
    },
    {
      id: "pdf-und-mail",
      heading: "Quittung herunterladen oder per E-Mail senden",
      blocks: [
        {
          type: "paragraph",
          text: "In der Quittungsliste haben Sie pro Beleg die Aktionen „PDF herunterladen“ (immer dasselbe archivierte PDF) und „Per E-Mail senden“.",
        },
        {
          type: "callout",
          variant: "warning",
          title: "E-Mail-Versand braucht eine Adresse",
          text: "Der E-Mail-Versand funktioniert nur, wenn beim Patienten eine E-Mail-Adresse hinterlegt ist. Fehlt sie, ist der Button deaktiviert – tragen Sie die Adresse im Patientendetail nach.",
        },
        {
          type: "callout",
          variant: "info",
          title: "Steht „kein PDF“?",
          text: "Dann ist die PDF-Erzeugung beim Ausstellen fehlgeschlagen. Der Beleg ist trotzdem gültig; Sie können das PDF neu erzeugen. Der Inhalt bleibt identisch, weil die Daten eingefroren sind.",
        },
      ],
    },
    {
      id: "sammellauf",
      heading: "Sammellauf für mehrere Patienten",
      blocks: [
        {
          type: "paragraph",
          text: "Für den Monatsabschluss erstellen Sie mit einem Schritt pro Patient eine Quittung – plus ein zusammengefügtes Sammel-PDF zum Ausdrucken.",
        },
        {
          type: "steps",
          steps: [
            {
              title: "Sammellauf öffnen",
              text: "In „Finanzen → Quittungen“ klicken Sie auf „Sammellauf“ und wählen den Zeitraum (meist der abgelaufene Monat).",
            },
            {
              title: "Patienten bestätigen",
              text: "Die App zeigt alle Patienten mit quittierbaren Fahrten samt Summe. Nicht gewünschte Patienten können Sie abwählen.",
            },
            {
              title: "Starten",
              text: "Klicken Sie auf „Sammellauf starten“ und bestätigen Sie. Pro Patient entsteht eine eigene Quittung; danach erhalten Sie ein mehrseitiges Sammel-PDF (eine Seite je Beleg).",
            },
          ],
        },
        {
          type: "callout",
          variant: "info",
          text: "Schlägt bei einem Patienten etwas fehl, läuft der Rest trotzdem durch. Im Ergebnis sehen Sie, welche Belege ausgestellt wurden und wo es ein Problem gab.",
        },
      ],
    },
    {
      id: "storno",
      heading: "Eine Quittung stornieren",
      blocks: [
        {
          type: "paragraph",
          text: "Eine ausgestellte Quittung ist unveränderlich. Ist ein Beleg falsch (falscher Zeitraum, falsche Fahrt, doppelt erstellt), stornieren Sie ihn und stellen ihn neu aus.",
        },
        {
          type: "steps",
          steps: [
            {
              title: "Beleg auswählen",
              text: "Suchen Sie den Beleg in der Quittungsliste und klicken Sie auf „Stornieren“.",
            },
            {
              title: "Begründung angeben",
              text: "Geben Sie eine Begründung ein (Pflichtfeld, mindestens 3 Zeichen) und bestätigen Sie.",
            },
          ],
        },
        {
          type: "callout",
          variant: "info",
          title: "Was passiert beim Storno",
          text: "Der Beleg wird als „storniert“ markiert, das PDF bleibt archiviert. Die zugehörigen Fahrten werden wieder quittierbar und können in eine neue, korrekte Quittung aufgenommen werden. Der Vorgang wird protokolliert. Einen separaten Storno-Gegenbeleg gibt es nicht.",
        },
      ],
    },
    {
      id: "fahrer-report",
      heading: "Fahrer-Report und Entschädigungssätze",
      blocks: [
        {
          type: "paragraph",
          text: "Unter „Finanzen → Fahrer“ sehen Sie pro Fahrer und Zeitraum die Fahrten, Kilometer, Einsatzzeit, Einnahmen (Bareinkasso) und die Entschädigung. Ein Klick auf einen Fahrer öffnet dessen Einzelfahrten; über den Export-Button laden Sie die Tabelle als CSV.",
        },
        {
          type: "paragraph",
          text: "Die Entschädigung wird live berechnet: Anzahl Fahrten × Pauschale + km × km-Satz. Die Sätze pflegt die Administration unter „Einstellungen → Organisation“ im Abschnitt „Fahrer-Entschädigung“ (Pauschale pro Fahrt und km-Satz).",
        },
        {
          type: "callout",
          variant: "warning",
          title: "Sätze wirken rückwirkend",
          text: "Die Sätze sind nicht pro Zeitraum versioniert. Ändern Sie einen Satz, ändert sich die Entschädigung rückwirkend in allen Reports. Passen Sie die Sätze erst an, nachdem ein Zeitraum ausgezahlt ist. Ein leeres Feld bedeutet „kein Satz“ (CHF 0).",
        },
      ],
    },
    {
      id: "dashboard-statistik",
      heading: "Dashboard und Statistik",
      blocks: [
        {
          type: "paragraph",
          text: "Das Dashboard („Finanzen“) zeigt Umsatz, Fahrten, gefahrene km und den Ø Preis pro Fahrt für den laufenden Monat – mit Vergleich zum Vormonat und Vorjahresmonat, dazu Verlaufscharts und Top-Listen. Unter „Statistik“ werten Sie flexibel nach Dimension (Zeit, Fahrer, Ziel, Zone, Patient, Richtung) und Kennzahl (Fahrten, km, Fahrzeit, Umsatz) aus und exportieren jede Auswertung als CSV.",
        },
        {
          type: "callout",
          variant: "info",
          title: "„—“ statt einer Prozentzahl",
          text: "In einem noch leeren Zeitraum (z. B. Monatsanfang ohne Vergleichsdaten) steht bei den Veränderungen ein „—“ statt einer Prozentzahl. Das bedeutet „kein Vergleich möglich“ und ist kein Fehler.",
        },
        {
          type: "callout",
          variant: "tip",
          title: "Nachberechnete Kilometer erkennen",
          text: "Die Statistik-Tabelle hat die Spalte „davon nachber.“ (davon nachberechnet). Ist der Wert grösser als null, wird er farblich hervorgehoben – so sehen Sie, welcher km-Anteil nicht aus der ursprünglichen Planung stammt. Fahrten ganz ohne Distanz werden separat gezählt und fliessen nicht in die km-Summe ein.",
        },
      ],
    },
    {
      id: "export",
      heading: "Fahrten exportieren (CSV)",
      blocks: [
        {
          type: "paragraph",
          text: "Unter „Finanzen → Export“ finden Sie die frühere Verrechnungs-Übersicht: alle Fahrten eines Zeitraums mit Datum, Person, Ziel, Zonen, Distanz und Preis. Über „CSV Export“ laden Sie die Liste als Datei für die Buchhaltung herunter; die Datei öffnet sich in Excel und enthält ganz unten die Gesamtsumme.",
        },
        {
          type: "callout",
          variant: "warning",
          title: "Auf „Ohne Preis“ achten",
          text: "Ist die Kachel „Ohne Preis“ rot und grösser als null, fehlt bei einzelnen Fahrten der Preis – meist, weil eine Adresse oder Zone fehlt. Öffnen Sie diese Fahrten und ergänzen Sie die Angaben, bevor Sie exportieren.",
        },
      ],
    },
  ],
}
