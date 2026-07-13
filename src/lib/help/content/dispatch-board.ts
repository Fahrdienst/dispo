import type { HelpArticle } from "@/lib/help/types"

/**
 * Article "Das Dispositions-Board verstehen" — real content.
 * Audience: operator and admin.
 */
export const dispatchBoard: HelpArticle = {
  slug: "dispatch-board",
  title: "Das Dispositions-Board verstehen",
  category: "disposition",
  audience: ["operator", "admin"],
  keywords: [
    "dispatch",
    "board",
    "disposition",
    "übersicht",
    "planung",
    "tag",
  ],
  summary:
    "Ein Überblick über den Bereich „Disposition“ und wie Sie damit den Tag planen.",
  sections: [
    {
      id: "einleitung",
      heading: "Was das Dispositions-Board zeigt",
      blocks: [
        {
          type: "paragraph",
          text: "Im Bereich „Disposition“ planen Sie einen Tag: Sie sehen alle Fahrten und teilen ihnen Fahrerinnen und Fahrer zu. Klicken Sie dazu oben im Menü auf „Disposition“.",
        },
        {
          type: "paragraph",
          text: "Die Ansicht ist zweigeteilt: Links stehen die Fahrten des Tages, rechts die „Fahrer-Übersicht“ mit allen verfügbaren Fahrerinnen und Fahrern.",
        },
        // TODO(content): Screenshot der Disposition-Tagesansicht (Fahrtenliste links, Fahrer-Übersicht rechts).
      ],
    },
    {
      id: "fahrtenliste",
      heading: "Die Fahrtenliste (links)",
      blocks: [
        {
          type: "paragraph",
          text: "Die Fahrten sind nach Uhrzeit geordnet. Zu jeder Fahrt sehen Sie:",
        },
        {
          type: "list",
          items: [
            "die Abholzeit,",
            "den Namen der Person (Nachname, Vorname),",
            "das Ziel und die Richtung (Hinfahrt, Rückfahrt oder Hin & Rück),",
            "ein farbiges Status-Abzeichen, zum Beispiel „Ungeplant“, „Geplant“ oder „Abgeschlossen“,",
            "rechts das Auswahlfeld, mit dem Sie einen Fahrer zuweisen.",
          ],
        },
        {
          type: "callout",
          variant: "tip",
          title: "Filter nutzen",
          text: "Über der Liste finden Sie Filter-Schaltflächen wie „Alle“, „Ungeplant“ oder „Geplant“ – jeweils mit der Anzahl in Klammern. Ein Klick zeigt nur Fahrten mit diesem Status. So finden Sie schnell die Fahrten, die noch einen Fahrer brauchen.",
        },
      ],
    },
    {
      id: "farben-hinweise",
      heading: "Farben und Hinweise verstehen",
      blocks: [
        {
          type: "list",
          items: [
            "Gelb hinterlegtes Auswahlfeld mit „— Fahrer zuweisen —“: Diese Fahrt hat noch keinen Fahrer.",
            "Roter Balken am linken Rand einer Fahrt: eine ungeplante Fahrt ohne Fahrer – sie braucht Ihre Aufmerksamkeit.",
            "Oben ein rotes Abzeichen „X ohne Fahrer“: So viele Fahrten warten noch auf eine Zuweisung.",
            "Ein gelbes Warndreieck „Zeitkonflikt“: Zwei Fahrten eines Fahrers überschneiden sich zeitlich – bitte prüfen.",
          ],
        },
        {
          type: "callout",
          variant: "info",
          title: "Fahrer-Übersicht rechts",
          text: "Rechts sehen Sie zu jeder Fahrerin und jedem Fahrer einen Punkt: grün heisst „heute verfügbar“, grau „heute nicht verfügbar“, gelb weist auf einen Zeitkonflikt hin. Daneben steht, wie viele Fahrten die Person bereits übernommen hat.",
        },
      ],
    },
    {
      id: "navigation",
      heading: "Zwischen Tagen und Wochen wechseln",
      blocks: [
        {
          type: "steps",
          steps: [
            {
              title: "Anderen Tag wählen",
              text: "Nutzen Sie oben „← Vorheriger Tag“ und „Nächster Tag →“. Mit „Heute“ springen Sie zum aktuellen Tag zurück.",
            },
            {
              title: "Ganze Woche ansehen",
              text: "Klicken Sie auf „Wochenansicht“. Sie sehen dann alle sieben Tage nebeneinander. Ein Klick auf einen Tag – oder auf „Tag öffnen“ – bringt Sie zurück zur Tagesplanung.",
            },
          ],
        },
      ],
    },
    {
      id: "tagesplan-drucken",
      heading: "Tagesplan ausdrucken",
      blocks: [
        {
          type: "paragraph",
          text: "Oben rechts finden Sie die Schaltfläche „Tagesplan drucken“. Ein Klick öffnet in einem neuen Fenster eine übersichtliche Liste aller Fahrten des Tages – mit Zeit, Person, Ziel, Fahrer und Bemerkungen. Der Druckdialog Ihres Browsers öffnet sich dabei automatisch.",
        },
        {
          type: "callout",
          variant: "warning",
          text: "In der Wochenansicht druckt diese Schaltfläche immer den heutigen Tag. Möchten Sie einen bestimmten anderen Tag drucken, öffnen Sie ihn zuerst in der Tagesansicht und klicken dann auf „Tagesplan drucken“.",
        },
      ],
    },
  ],
}
