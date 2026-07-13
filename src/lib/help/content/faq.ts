import type { HelpArticle } from "@/lib/help/types"

/**
 * Frequently asked questions — real content. Visible to everyone.
 */
export const faq: HelpArticle = {
  slug: "faq",
  title: "Häufige Fragen",
  category: "hilfe",
  audience: ["public", "driver", "operator", "admin"],
  keywords: [
    "faq",
    "fragen",
    "antworten",
    "hilfe",
    "problem",
    "funktioniert nicht",
    "häufig",
  ],
  summary:
    "Kurze Antworten auf die Fragen, die am häufigsten gestellt werden.",
  sections: [
    {
      id: "anmeldung",
      heading: "Rund um die Anmeldung",
      blocks: [
        {
          type: "paragraph",
          text: "Ich kann mich nicht anmelden. Was tun?",
        },
        {
          type: "list",
          items: [
            "Prüfen Sie, ob die E-Mail-Adresse richtig geschrieben ist.",
            "Achten Sie beim Passwort auf Gross- und Kleinschreibung.",
            "Prüfen Sie, ob die Feststelltaste (Caps Lock) aktiv ist.",
            "Hilft nichts, bittet Sie die Administration um ein neues Passwort.",
          ],
        },
      ],
    },
    {
      id: "bedienung",
      heading: "Rund um die Bedienung",
      blocks: [
        {
          type: "paragraph",
          text: "Ich habe mich verklickt. Ist etwas kaputt?",
        },
        {
          type: "paragraph",
          text: "Nein. Sie können nichts kaputt machen. Wenn Sie einen Eintrag falsch gespeichert haben, öffnen Sie ihn erneut und ändern Sie ihn. Fahrten lassen sich jederzeit bearbeiten.",
        },
        {
          type: "callout",
          variant: "tip",
          title: "Tipp",
          text: "Die Schrift ist Ihnen zu klein? Halten Sie die Taste „Strg“ (unten links auf der Tastatur) gedrückt und drücken Sie mehrmals auf „+“. So wird alles grösser.",
        },
      ],
    },
    {
      id: "daten",
      heading: "Rund um die Daten",
      blocks: [
        {
          type: "paragraph",
          text: "Wer kann meine Eingaben sehen?",
        },
        {
          type: "paragraph",
          text: "Nur berechtigte Personen Ihrer Organisation. Fahrerinnen und Fahrer sehen nur ihre eigenen Fahrten. Die Disposition und die Administration sehen die Planung, die sie für ihre Arbeit brauchen.",
        },
      ],
    },
  ],
}
