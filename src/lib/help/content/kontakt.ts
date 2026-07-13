import type { HelpArticle } from "@/lib/help/types"

/**
 * Contact article — real content. Visible to everyone.
 *
 * NOTE: The concrete contact details (phone number, e-mail, opening hours)
 * are placeholders and should be confirmed with the operator before launch.
 */
export const kontakt: HelpArticle = {
  slug: "kontakt",
  title: "Kontakt und Unterstützung",
  category: "hilfe",
  audience: ["public", "driver", "operator", "admin"],
  keywords: [
    "kontakt",
    "hilfe",
    "telefon",
    "anrufen",
    "e-mail",
    "unterstützung",
    "ansprechperson",
    "support",
  ],
  summary:
    "So erreichen Sie eine Person, die Ihnen persönlich weiterhilft.",
  sections: [
    {
      id: "wer-hilft",
      heading: "Wer hilft mir weiter?",
      blocks: [
        {
          type: "paragraph",
          text: "Wenn Sie einmal nicht weiterkommen, ist das kein Problem. Es gibt immer eine Person, die Ihnen hilft.",
        },
        {
          type: "list",
          items: [
            "Bei Fragen zur Planung: Ihre Ansprechperson in der Disposition.",
            "Bei Fragen zur Anmeldung oder zum Passwort: die Administration.",
            "Bei technischen Problemen: die im Betrieb benannte Support-Stelle.",
          ],
        },
      ],
    },
    {
      id: "erreichbarkeit",
      heading: "So erreichen Sie uns",
      blocks: [
        {
          type: "callout",
          variant: "info",
          title: "Bitte prüfen",
          text: "Die folgenden Angaben sind Platzhalter und werden vor der Inbetriebnahme durch die echten Kontaktdaten Ihres Betriebs ersetzt.",
        },
        {
          type: "list",
          items: [
            "Telefon: 000 000 00 00 (Montag bis Freitag, 08:00–17:00 Uhr)",
            "E-Mail: hilfe@example.org",
          ],
        },
        {
          type: "paragraph",
          text: "Halten Sie bei einem Anruf möglichst bereit, was Sie gerade getan haben und was nicht funktioniert hat. So können wir Ihnen schneller helfen.",
        },
      ],
    },
  ],
}
