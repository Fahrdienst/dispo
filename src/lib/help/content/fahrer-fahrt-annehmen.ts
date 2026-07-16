import type { HelpArticle } from "@/lib/help/types"

/**
 * Article "Eine Fahrt annehmen oder ablehnen" for drivers — real content.
 * Audience: driver.
 */
export const fahrerFahrtAnnehmen: HelpArticle = {
  slug: "fahrer-fahrt-annehmen",
  title: "Eine Fahrt annehmen oder ablehnen",
  category: "fahrer",
  audience: ["driver"],
  keywords: [
    "annehmen",
    "ablehnen",
    "bestätigen",
    "fahrt",
    "zusage",
    "absage",
    "e-mail",
  ],
  summary:
    "So bestätigen oder verweigern Sie eine Ihnen zugewiesene Fahrt – per E-Mail-Link oder direkt in der App.",
  sections: [
    {
      id: "einleitung",
      heading: "So werden Sie über neue Fahrten informiert",
      blocks: [
        {
          type: "paragraph",
          text: "Wird Ihnen eine Fahrt zugeteilt, erhalten Sie eine E-Mail mit dem Betreff „Neue Fahrt am …“. Darin stehen die wichtigsten Angaben: Person, Ziel, Datum, Abholzeit und Richtung. Sie können direkt aus der E-Mail antworten – oder später in der App.",
        },
        {
          type: "callout",
          variant: "info",
          text: "Bitte antworten Sie möglichst zügig. Bei Fahrten mit etwas Vorlauf haben Sie in der Regel bis zu 48 Stunden Zeit; bei kurzfristigen Fahrten (Start in weniger als 48 Stunden) ist das Zeitfenster deutlich kürzer. Bleibt eine Antwort aus, erhalten Sie eine Erinnerung, und die Einteilung fragt gegebenenfalls eine andere Fahrerin oder einen anderen Fahrer an.",
        },
      ],
    },
    {
      id: "per-email",
      heading: "Per E-Mail antworten",
      blocks: [
        {
          type: "steps",
          steps: [
            {
              title: "E-Mail öffnen",
              text: "Öffnen Sie die E-Mail. Sie enthält zwei Schaltflächen: „Fahrt annehmen“ (grün) und „Fahrt ablehnen“ (rot).",
            },
            {
              title: "Schaltfläche anklicken",
              text: "Klicken Sie auf die passende Schaltfläche. Es öffnet sich eine Seite in Ihrem Browser.",
            },
            {
              title: "Bestätigen",
              text: "Auf dieser Seite bestätigen Sie Ihre Wahl noch einmal – mit „Fahrt annehmen“ beziehungsweise „Fahrt ablehnen“. Erst dieser zweite Klick ist verbindlich.",
            },
          ],
        },
        {
          type: "callout",
          variant: "info",
          title: "Was passiert danach?",
          text: "Nehmen Sie an, erscheint „Fahrt angenommen“ – die Einteilung ist informiert. Lehnen Sie ab, erscheint „Fahrt abgelehnt“, und die Einteilung sucht eine andere Person. Ihre Antwort wird nur durch das Öffnen des Links noch nicht ausgelöst; erst der Klick auf die Bestätigung zählt.",
        },
      ],
    },
    {
      id: "in-der-app",
      heading: "Direkt in der App antworten",
      blocks: [
        {
          type: "paragraph",
          text: "Sie können auch ohne E-Mail antworten. Öffnen Sie „Meine Fahrten“. Offene Anfragen erscheinen ganz oben im Bereich „Offene Zuweisungen“ mit einem gelben Rand.",
        },
        {
          type: "steps",
          steps: [
            {
              title: "Anfrage prüfen",
              text: "Lesen Sie die Angaben zur Fahrt: Uhrzeit, Person, Ziel und Richtung.",
            },
            {
              title: "Annehmen oder ablehnen",
              text: "Tippen Sie auf „Annehmen“ (grün) oder „Ablehnen“ (rot). „Annehmen“ bestätigt die Fahrt sofort.",
            },
            {
              title: "Bei Ablehnung: Grund angeben",
              text: "Beim Ablehnen werden Sie nach einem Grund gefragt. Wählen Sie einen aus – zum Beispiel „Terminkonflikt“, „Zu weit entfernt“, „Fahrzeugproblem“, „Persönliche Gründe“ oder „Sonstiges“. Eine kurze Anmerkung ist freiwillig. Tippen Sie dann auf „Ablehnen“.",
            },
          ],
        },
        {
          type: "callout",
          variant: "tip",
          text: "Ein Grund für die Ablehnung hilft der Einteilung, schnell eine gute Lösung zu finden. Erhalten Sie eine Erinnerungs-E-Mail, führt Sie deren Schaltfläche „In der App antworten“ direkt zu „Meine Fahrten“.",
        },
      ],
    },
  ],
}
