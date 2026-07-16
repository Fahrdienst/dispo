import type { HelpArticle } from "@/lib/help/types"

/**
 * Tutorial "Einen Fahrer zuweisen" — real content.
 * Audience: operator and admin (they dispatch rides).
 */
export const fahrerZuweisen: HelpArticle = {
  slug: "fahrer-zuweisen",
  title: "Anleitung: Einen Fahrer zuweisen",
  category: "disposition",
  audience: ["operator", "admin"],
  keywords: ["fahrer", "zuweisen", "einteilen", "disposition", "zuordnen"],
  summary:
    "Schritt für Schritt: So teilen Sie einer Fahrt die passende Fahrerin oder den passenden Fahrer zu.",
  sections: [
    {
      id: "einleitung",
      heading: "Worum es geht",
      blocks: [
        {
          type: "paragraph",
          text: "Eine neu erfasste Fahrt hat zunächst noch keinen Fahrer. Im Bereich „Disposition“ sehen Sie alle Fahrten eines Tages und weisen ihnen eine Fahrerin oder einen Fahrer zu. Das Zuweisen dauert nur wenige Klicks.",
        },
        {
          type: "callout",
          variant: "info",
          text: "Fahrten ohne Fahrer erkennen Sie sofort: Ihr Auswahlfeld ist gelb hinterlegt und zeigt den Hinweis „— Fahrer zuweisen —“. Oben in der Liste steht zusätzlich, wie viele Fahrten noch „ohne Fahrer“ sind.",
        },
      ],
    },
    {
      id: "disposition-oeffnen",
      heading: "Den Tag öffnen",
      blocks: [
        {
          type: "steps",
          steps: [
            {
              title: "Bereich „Disposition“ öffnen",
              text: "Klicken Sie links im Menü auf „Disposition“. Sie sehen den heutigen Tag mit allen Fahrten.",
            },
            {
              title: "Zum richtigen Tag wechseln",
              text: "Möchten Sie einen anderen Tag einteilen, verwenden Sie oben die Schaltflächen „← Vorheriger Tag“ und „Nächster Tag →“. Mit „Heute“ kehren Sie jederzeit zum aktuellen Tag zurück.",
            },
          ],
        },
        // TODO(content): Screenshot der Disposition-Tagesansicht mit Fahrtenliste links und Fahrer-Übersicht rechts.
      ],
    },
    {
      id: "fahrer-waehlen",
      heading: "Den Fahrer auswählen",
      blocks: [
        {
          type: "steps",
          steps: [
            {
              title: "Die Fahrt in der Liste finden",
              text: "Auf der linken Seite stehen die Fahrten des Tages, geordnet nach Uhrzeit. Zu jeder Fahrt sehen Sie die Abholzeit, den Namen der Person und das Ziel.",
            },
            {
              title: "Das Auswahlfeld öffnen",
              text: "Rechts an der Fahrt befindet sich ein Auswahlfeld. Klicken Sie darauf. Es öffnet sich eine Liste mit allen Fahrerinnen und Fahrern.",
            },
            {
              title: "Verfügbarkeit beachten",
              text: "Ein grünes Häkchen neben einem Namen bedeutet: Die Person ist zu dieser Zeit verfügbar. Ein gelbes Warndreieck bedeutet: Die Person hat zu dieser Zeit bereits eine andere Fahrt (ein möglicher Zeitkonflikt).",
            },
            {
              title: "Fahrer anklicken",
              text: "Klicken Sie den passenden Namen an. Die Zuweisung wird in der Regel sofort gespeichert – Sie müssen nichts extra bestätigen.",
            },
          ],
        },
        {
          type: "callout",
          variant: "info",
          title: "Abwesende und nicht verfügbare Fahrer",
          text: "Fahrerinnen und Fahrer, die an diesem Tag abwesend sind, erscheinen in der Liste ausgegraut und lassen sich nicht auswählen. Wählen Sie jemanden, der zu dieser Zeit nicht als verfügbar eingetragen ist, fragt die App zur Sicherheit noch einmal nach („Ausserhalb der Verfügbarkeit – Trotzdem zuweisen?“).",
        },
        {
          type: "callout",
          variant: "tip",
          title: "Tipp",
          text: "Rechts neben der Fahrtenliste finden Sie die „Fahrer-Übersicht“. Dort sehen Sie auf einen Blick, wer heute verfügbar ist (grüner Punkt), wer nicht (grauer Punkt) und wie viele Fahrten jede Person schon hat.",
        },
      ],
    },
    {
      id: "aendern-entfernen",
      heading: "Zuweisung ändern oder entfernen",
      blocks: [
        {
          type: "paragraph",
          text: "Sie können eine Zuweisung jederzeit korrigieren. Öffnen Sie dazu erneut das Auswahlfeld an der Fahrt.",
        },
        {
          type: "list",
          items: [
            "Anderen Fahrer wählen: Klicken Sie einfach einen anderen Namen an.",
            "Zuweisung ganz entfernen: Wählen Sie den obersten Eintrag „— Kein Fahrer —“. Die Fahrt ist dann wieder ohne Fahrer.",
          ],
        },
        {
          type: "callout",
          variant: "warning",
          title: "Achtung bei Zeitkonflikten",
          text: "Wählen Sie einen Fahrer mit gelbem Warndreieck, wird die Fahrt trotzdem zugewiesen. Prüfen Sie in diesem Fall, ob die Zeiten wirklich zusammenpassen, damit sich keine zwei Fahrten überschneiden.",
        },
      ],
    },
  ],
}
