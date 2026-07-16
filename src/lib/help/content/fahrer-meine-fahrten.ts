import type { HelpArticle } from "@/lib/help/types"

/**
 * Article "Meine Fahrten" for drivers — real content.
 * Audience: driver.
 */
export const fahrerMeineFahrten: HelpArticle = {
  slug: "fahrer-meine-fahrten",
  title: "Meine Fahrten: Ihre Einsätze im Überblick",
  category: "fahrer",
  audience: ["driver"],
  keywords: [
    "meine fahrten",
    "einsätze",
    "fahrer",
    "übersicht",
    "heute",
    "termine",
  ],
  summary:
    "So sehen Sie als Fahrerin oder Fahrer Ihre eingeteilten Fahrten und halten den Verlauf einer Fahrt fest.",
  sections: [
    {
      id: "einleitung",
      heading: "Ihre Fahrten des Tages",
      blocks: [
        {
          type: "paragraph",
          text: "Unter „Meine Fahrten“ sehen Sie alle Fahrten, die Ihnen zugeteilt wurden. Klicken Sie dazu links im Menü auf „Meine Fahrten“. Die App zeigt zunächst den heutigen Tag.",
        },
        // TODO(content): Screenshot der Fahrer-Ansicht "Meine Fahrten" mit einer Fahrtkarte.
      ],
    },
    {
      id: "fahrt-lesen",
      heading: "Was eine Fahrt anzeigt",
      blocks: [
        {
          type: "paragraph",
          text: "Jede Fahrt wird als Karte dargestellt. Sie sehen darauf:",
        },
        {
          type: "list",
          items: [
            "die Abholzeit gross oben,",
            "den Namen der Person und das Ziel,",
            "die Richtung (Hinfahrt, Rückfahrt oder Hin & Rück),",
            "einen Fortschrittsbalken, der den Stand der Fahrt zeigt,",
            "eine Schaltfläche zum Starten der Navigation,",
            "einen Link „Details anzeigen“ zur Detailseite mit Kartenansicht.",
          ],
        },
        {
          type: "callout",
          variant: "tip",
          title: "Zum Ziel navigieren",
          text: "Die grosse Schaltfläche führt Sie mit Google Maps zur richtigen Adresse. Vor dem Abholen heisst sie „Abholung ansteuern“ (zur Person), danach „Ziel ansteuern“ (zum Ziel). Die Navigation öffnet sich in einem neuen Fenster.",
        },
      ],
    },
    {
      id: "detailseite",
      heading: "Die Route auf der Karte ansehen",
      blocks: [
        {
          type: "paragraph",
          text: "Über „Details anzeigen“ auf einer Fahrtkarte öffnen Sie die Detailseite der Fahrt. Dort finden Sie unter anderem eine Karte, die den Weg von der Abholadresse (roter Punkt „H“) zum Ziel (blauer Punkt „Z“) zeigt.",
        },
        {
          type: "callout",
          variant: "info",
          text: "Ist für eine Fahrt noch keine Route hinterlegt, zeigt die Karte nur die beiden Punkte ohne Verbindungslinie. Für die eigentliche Turn-by-turn-Navigation nutzen Sie weiterhin die Schaltflächen „Abholung ansteuern“ bzw. „Ziel ansteuern“.",
        },
      ],
    },
    {
      id: "tag-wechseln",
      heading: "Einen anderen Tag ansehen",
      blocks: [
        {
          type: "paragraph",
          text: "Mit den Schaltflächen „← Vorheriger Tag“ und „Nächster Tag →“ blättern Sie durch die Tage. Sind Sie nicht beim heutigen Tag, bringt Sie „Heute“ zurück. Haben Sie an einem Tag keine Fahrt, erscheint der Hinweis „Keine Fahrten für diesen Tag“.",
        },
      ],
    },
    {
      id: "status-setzen",
      heading: "Den Verlauf einer Fahrt festhalten",
      blocks: [
        {
          type: "paragraph",
          text: "Während einer Fahrt tippen Sie auf die grosse farbige Schaltfläche, sobald der nächste Schritt erreicht ist. So weiss die Einteilung jederzeit, wo Sie gerade sind. Je nach Stand der Fahrt heisst die Schaltfläche:",
        },
        {
          type: "list",
          items: [
            "„Fahrt starten“ – wenn Sie losfahren,",
            "„Patient abgeholt“ – wenn die Person eingestiegen ist,",
            "„Am Ziel angekommen“ – wenn Sie das Ziel erreicht haben,",
            "„Fahrt abgeschlossen“ – wenn die Fahrt beendet ist.",
          ],
        },
        {
          type: "callout",
          variant: "info",
          text: "„Fahrt abgeschlossen“ müssen Sie noch einmal bestätigen („Ja, abschliessen“), da dieser Schritt nicht rückgängig gemacht werden kann. Ist eine Person nicht da, nutzen Sie die Schaltfläche „Nicht erschienen“.",
        },
        {
          type: "callout",
          variant: "warning",
          title: "Ist etwas nicht in Ordnung?",
          text: "Über „Problem melden“ können Sie der Einteilung kurz schreiben, was passiert ist – zum Beispiel eine Verspätung. Der Stand der Fahrt ändert sich dadurch nicht; die Einteilung wird nur informiert.",
        },
      ],
    },
  ],
}
