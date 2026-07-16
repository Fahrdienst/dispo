import type { HelpArticle } from "@/lib/help/types"

/**
 * Getting-started article — real content. Visible to everyone.
 */
export const ersteSchritte: HelpArticle = {
  slug: "erste-schritte",
  title: "Erste Schritte: So melden Sie sich an",
  category: "grundlagen",
  audience: ["public", "driver", "operator", "admin"],
  keywords: [
    "anmelden",
    "login",
    "einloggen",
    "passwort",
    "start",
    "beginnen",
    "erste schritte",
    "abmelden",
  ],
  summary:
    "Von der Anmeldung bis zur Startseite: die ersten Schritte in der Fahrdienst-App, ruhig erklärt.",
  sections: [
    {
      id: "anmelden",
      heading: "Anmelden",
      blocks: [
        {
          type: "steps",
          steps: [
            {
              title: "Seite öffnen",
              text: "Öffnen Sie die Fahrdienst-App im Internet-Browser. Sie sehen ein Feld für die E-Mail-Adresse und ein Feld für das Passwort.",
            },
            {
              title: "E-Mail eingeben",
              text: "Tippen Sie Ihre E-Mail-Adresse ein. Achten Sie darauf, dass keine Leerzeichen davor oder dahinter stehen.",
            },
            {
              title: "Passwort eingeben",
              text: "Tippen Sie Ihr Passwort ein. Gross- und Kleinschreibung sind wichtig.",
            },
            {
              title: "Anmelden",
              text: "Klicken Sie auf die Schaltfläche „Anmelden“. Danach sehen Sie Ihre Startseite.",
            },
          ],
        },
        {
          type: "callout",
          variant: "warning",
          title: "Passwort vergessen?",
          text: "Klicken Sie auf der Anmeldeseite auf „Passwort vergessen?“. Sie erhalten dann per E-Mail einen Link, mit dem Sie sich selbst ein neues Passwort setzen können. Klappt das nicht, wenden Sie sich an Ihre Ansprechperson in der Administration.",
        },
      ],
    },
    {
      id: "orientierung",
      heading: "Sich zurechtfinden",
      blocks: [
        {
          type: "paragraph",
          text: "Nach der Anmeldung sehen Sie oben Ihren Namen und links das Menü. Die grosse Fläche in der Mitte zeigt den jeweils gewählten Bereich.",
        },
        {
          type: "screenshot",
          src: "/help/screenshots/erste-schritte-startseite.png",
          alt: "Die Startseite nach der Anmeldung mit Menü links und den Kennzahlen des Tages in der Mitte.",
          caption: "Ihre Startseite nach dem Anmelden.",
        },
      ],
    },
    {
      id: "abmelden",
      heading: "Abmelden",
      blocks: [
        {
          type: "paragraph",
          text: "Wenn Sie fertig sind, melden Sie sich ab. So schützen Sie die Daten. Klicken Sie dazu unten im Menü auf „Abmelden“.",
        },
        {
          type: "callout",
          variant: "info",
          text: "An einem gemeinsam genutzten Computer sollten Sie sich immer abmelden, bevor Sie weggehen.",
        },
      ],
    },
  ],
}
