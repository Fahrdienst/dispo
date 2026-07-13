import type { HelpArticle } from "@/lib/help/types"

/**
 * Article "Tarife pflegen" for admins — real content.
 * Audience: admin.
 */
export const adminTarife: HelpArticle = {
  slug: "admin-tarife",
  title: "Tarife pflegen",
  category: "administration",
  audience: ["admin"],
  keywords: [
    "tarife",
    "preise",
    "abrechnung",
    "zonen",
    "kosten",
    "pflegen",
  ],
  summary:
    "So sind die Tarife aufgebaut und wie Sie die Zonen pflegen, aus denen sich die Preise ergeben.",
  sections: [
    {
      id: "einleitung",
      heading: "So entsteht der Preis einer Fahrt",
      blocks: [
        {
          type: "paragraph",
          text: "Der Preis einer Fahrt richtet sich nach dem Zielgebiet (der „Zone“) und der Aufenthaltsdauer. Die App berechnet ihn automatisch – Sie müssen also nicht bei jeder Fahrt einen Preis eintragen.",
        },
        {
          type: "paragraph",
          text: "Die Tarife erreichen Sie über den Menüpunkt „Einstellungen“ und dort über die Reiter „Zonen“, „Zonenkarte“ und „Tarife“.",
        },
      ],
    },
    {
      id: "tarifmodell",
      heading: "Die Zonen und ihre Preise",
      blocks: [
        {
          type: "paragraph",
          text: "Es gibt fünf Zonen, gestaffelt nach Entfernung von Dübendorf:",
        },
        {
          type: "list",
          items: [
            "Gemeinde Dübendorf: Einfache Fahrt CHF 8, Hin & Rück bis 2 Std. CHF 12, ab 2 Std. CHF 16 (Sonderfall Tagesheim Imwil: CHF 14).",
            "Zone 1 (Nachbargemeinden): bis 2 Std. CHF 16, ab 2 Std. CHF 24.",
            "Zone 2 (Mittlerer Ring): bis 2 Std. CHF 25, ab 2 Std. CHF 45.",
            "Zone 3 (bis Kantonsgrenze): bis 2 Std. CHF 35, ab 2 Std. CHF 55.",
            "Ausserkantonal: CHF 1.00 pro Kilometer, bei Begleitung im Spital zusätzlich CHF 20.",
          ],
        },
        {
          type: "callout",
          variant: "tip",
          title: "Alles auf einen Blick",
          text: "Diese Preise finden Sie jederzeit im Reiter „Zonenkarte“ – dort unter der Landkarte als Tabelle „Tarifübersicht“. So müssen Sie die Beträge nicht auswendig kennen.",
        },
        {
          type: "callout",
          variant: "info",
          text: "Diese Grundpreise sind fest hinterlegt. Ändert sich das Tarifmodell grundlegend, wenden Sie sich bitte an Ihre technische Ansprechperson.",
        },
      ],
    },
    {
      id: "zonen-pflegen",
      heading: "Was Sie selbst pflegen: die Zonen",
      blocks: [
        {
          type: "paragraph",
          text: "Der wichtigste Hebel in Ihrer Hand ist die Zuordnung der Postleitzahlen zu den Zonen. Stimmt sie, wird jede Fahrt automatisch der richtigen Zone – und damit dem richtigen Preis – zugeordnet.",
        },
        {
          type: "steps",
          steps: [
            {
              title: "Reiter „Zonen“ öffnen",
              text: "Öffnen Sie „Einstellungen“ und wechseln Sie auf den Reiter „Zonen“.",
            },
            {
              title: "Zone öffnen oder anlegen",
              text: "Klicken Sie eine bestehende Zone zum Bearbeiten an oder legen Sie mit „Neue Zone“ eine neue an.",
            },
            {
              title: "Postleitzahlen eintragen",
              text: "Tragen Sie im Bereich „Postleitzahlen“ die PLZ ein, die zu dieser Zone gehören, und klicken Sie auf „Hinzufügen“. Eine falsch zugeordnete PLZ entfernen Sie über das kleine × neben ihr.",
            },
          ],
        },
        // TODO(content): Screenshot der Zonen-Bearbeitung mit dem Bereich "Postleitzahlen".
        {
          type: "callout",
          variant: "warning",
          text: "Prüfen Sie nach Änderungen an den Zonen die Verrechnungs-Übersicht auf Fahrten „ohne Zonenzuordnung“ – dort sehen Sie, ob eine PLZ noch keiner Zone zugewiesen ist.",
        },
      ],
    },
    {
      id: "tarifversionen",
      heading: "Reiter „Tarife“",
      blocks: [
        {
          type: "paragraph",
          text: "Im Reiter „Tarife“ werden „Tarifversionen“ mit Namen und Gültigkeitszeitraum verwaltet. Über „Neue Tarifversion“ legen Sie einen Eintrag mit „Name“, „Gültig ab“ und optional „Gültig bis“ an.",
        },
        {
          type: "callout",
          variant: "info",
          text: "Nehmen Sie hier nur nach Absprache mit Ihrer technischen Ansprechperson Änderungen vor. Die laufende Preisberechnung der Fahrten stützt sich auf das oben beschriebene, fest hinterlegte Zonen-Tarifmodell.",
        },
      ],
    },
  ],
}
