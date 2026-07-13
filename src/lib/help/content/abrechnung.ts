import type { HelpArticle } from "@/lib/help/types"

/**
 * Article "Abrechnung: Fahrten verrechnen" — real content.
 * Audience: operator and admin.
 */
export const abrechnung: HelpArticle = {
  slug: "abrechnung",
  title: "Abrechnung: Fahrten verrechnen",
  category: "abrechnung",
  audience: ["operator", "admin"],
  keywords: [
    "abrechnung",
    "verrechnung",
    "rechnung",
    "kosten",
    "tarif",
    "preis",
    "export",
    "csv",
  ],
  summary:
    "So sehen Sie die Preise aller Fahrten eines Monats und laden sie für die Abrechnung als Datei herunter.",
  sections: [
    {
      id: "einleitung",
      heading: "So funktioniert die Abrechnung",
      blocks: [
        {
          type: "paragraph",
          text: "Für jede Fahrt berechnet die App automatisch einen Preis – anhand der Zonen und der Tarife. Sie müssen also nichts von Hand ausrechnen. Im Bereich „Verrechnung“ sehen Sie alle Fahrten eines Zeitraums gesammelt und können sie als Datei für Ihre Buchhaltung herunterladen.",
        },
        {
          type: "callout",
          variant: "info",
          text: "Es gibt keinen Knopf „Rechnung erstellen“ und keine fertigen Rechnungs-Dokumente. Die App liefert eine übersichtliche Liste aller Fahrten mit ihren Preisen – die eigentliche Rechnung erstellen Sie mit Ihrem gewohnten Programm.",
        },
      ],
    },
    {
      id: "uebersicht-oeffnen",
      heading: "Die Verrechnungs-Übersicht öffnen",
      blocks: [
        {
          type: "steps",
          steps: [
            {
              title: "Bereich „Verrechnung“ öffnen",
              text: "Klicken Sie oben im Menü auf „Verrechnung“. Sie sehen automatisch den aktuellen Monat.",
            },
            {
              title: "Zeitraum wählen",
              text: "Mit „← Vorheriger Monat“ und „Nächster Monat →“ wechseln Sie den Monat. Mit „Aktueller Monat“ kehren Sie zum laufenden Monat zurück.",
            },
          ],
        },
        // TODO(content): Screenshot der Verrechnungs-Seite mit Kennzahl-Kacheln und Fahrtentabelle.
      ],
    },
    {
      id: "uebersicht-lesen",
      heading: "Die Übersicht lesen",
      blocks: [
        {
          type: "paragraph",
          text: "Oben sehen Sie vier Kacheln mit den wichtigsten Zahlen des Zeitraums:",
        },
        {
          type: "list",
          items: [
            "„Fahrten“: die Anzahl der Fahrten,",
            "„Gesamtumsatz“: die Summe aller Preise,",
            "„Overrides“: wie oft ein Preis von Hand angepasst wurde,",
            "„Ohne Preis“: Fahrten, für die noch kein Preis berechnet wurde.",
          ],
        },
        {
          type: "paragraph",
          text: "Darunter steht die Tabelle mit allen Fahrten – mit Datum, Person, Ziel, Zonen, Distanz und Preis. Über das Suchfeld finden Sie eine bestimmte Fahrt nach Person, Ziel oder Fahrer.",
        },
        {
          type: "callout",
          variant: "warning",
          title: "Auf „Ohne Preis“ achten",
          text: "Ist die Zahl bei „Ohne Preis“ rot und grösser als null, fehlt bei einzelnen Fahrten der Preis – meist, weil eine Adresse oder Zone fehlt. Öffnen Sie diese Fahrten und ergänzen Sie die Angaben, bevor Sie exportieren.",
        },
      ],
    },
    {
      id: "export",
      heading: "Fahrten herunterladen (CSV-Export)",
      blocks: [
        {
          type: "steps",
          steps: [
            {
              title: "Zeitraum einstellen",
              text: "Stellen Sie zuerst den Monat ein, den Sie abrechnen möchten.",
            },
            {
              title: "Auf „CSV Export“ klicken",
              text: "Klicken Sie oben rechts auf „CSV Export“. Die App erstellt eine Datei mit allen Fahrten des Zeitraums und lädt sie herunter.",
            },
            {
              title: "Datei öffnen",
              text: "Die Datei können Sie mit einem Tabellenprogramm wie Excel öffnen. Sie enthält je Fahrt eine Zeile mit Datum, Person, Adresse, Ziel, Zonen, Distanz und Preis sowie ganz unten die Gesamtsumme.",
            },
          ],
        },
        {
          type: "callout",
          variant: "tip",
          text: "Eine CSV-Datei ist eine einfache Tabellendatei. Sie öffnet sich in der Regel direkt in Excel. Der Dateiname enthält den Zeitraum, damit Sie die Datei später leicht wiederfinden.",
        },
      ],
    },
    {
      id: "preis-pro-fahrt",
      heading: "Woher kommt der Preis einer Fahrt?",
      blocks: [
        {
          type: "paragraph",
          text: "Den Preis sehen Sie auch direkt bei jeder einzelnen Fahrt – im Fahrten-Formular unter „Tarif“ und auf der Detailseite der Fahrt unter „Route und Preis“. Berechnet wird er automatisch aus der Zone des Ziels und der Aufenthaltsdauer.",
        },
        {
          type: "callout",
          variant: "info",
          title: "Preis von Hand anpassen",
          text: "In Ausnahmefällen können Sie im Fahrten-Formular das Häkchen „Preis manuell überschreiben“ setzen und einen eigenen Betrag mit Begründung eintragen. Solche Fahrten erscheinen in der Übersicht als „Overrides“ und sind mit einem Sternchen beim Preis markiert.",
        },
      ],
    },
  ],
}
