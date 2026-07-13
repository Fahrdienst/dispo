import type {
  HelpArticle,
  HelpAudience,
  HelpCategory,
} from "@/lib/help/types"

/**
 * Placeholder articles. Structure, routing, filtering and search are fully
 * wired; the prose is still a TODO and will be written as separate content
 * work. Every stub is a fully typed `HelpArticle` so the app type-checks and
 * builds today.
 */

interface StubInput {
  slug: string
  title: string
  category: HelpCategory
  audience: HelpAudience[]
  keywords: string[]
  summary: string
}

/**
 * Build a typed stub article with a single "in Arbeit" section and a callout
 * that clearly marks the content as a placeholder.
 */
function makeStub(input: StubInput): HelpArticle {
  return {
    slug: input.slug,
    title: input.title,
    category: input.category,
    audience: input.audience,
    keywords: input.keywords,
    summary: input.summary,
    sections: [
      {
        id: "in-arbeit",
        heading: "Dieser Abschnitt wird noch geschrieben",
        blocks: [
          {
            type: "callout",
            variant: "info",
            title: "In Arbeit",
            // TODO(content): Replace with the real, step-by-step article text.
            text: "Diese Anleitung wird gerade erstellt. Der ausführliche Text folgt in Kürze. Bei Fragen hilft Ihnen bis dahin gerne Ihre Ansprechperson weiter.",
          },
          {
            type: "paragraph",
            // TODO(content): Real introductory paragraph.
            text: "Platzhalter: Hier entsteht eine ausführliche, leicht verständliche Anleitung zum Thema „" +
              input.title +
              "“.",
          },
        ],
      },
    ],
  }
}

/** Operator/Admin tutorials (#85 / #86) — still to be written. */
export const operatorStubs: HelpArticle[] = [
  makeStub({
    slug: "fahrer-zuweisen",
    title: "Anleitung: Einen Fahrer zuweisen",
    category: "disposition",
    audience: ["operator", "admin"],
    keywords: ["fahrer", "zuweisen", "einteilen", "disposition", "zuordnen"],
    summary:
      "Schritt für Schritt: So teilen Sie einer Fahrt die passende Fahrerin oder den passenden Fahrer zu.",
  }),
  makeStub({
    slug: "serie-anlegen",
    title: "Anleitung: Eine Fahrtserie anlegen",
    category: "fahrten",
    audience: ["operator", "admin"],
    keywords: [
      "serie",
      "fahrtserie",
      "wiederholung",
      "regelmässig",
      "wöchentlich",
      "termin",
    ],
    summary:
      "So legen Sie wiederkehrende Fahrten an, die sich regelmässig wiederholen.",
  }),
  makeStub({
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
      "Ein Überblick über das Dispositions-Board und wie Sie damit den Tag planen.",
  }),
  makeStub({
    slug: "patient-anlegen",
    title: "Anleitung: Eine Patientin oder einen Patienten anlegen",
    category: "stammdaten",
    audience: ["operator", "admin"],
    keywords: [
      "patient",
      "anlegen",
      "stammdaten",
      "adresse",
      "person",
      "neu",
    ],
    summary:
      "So speichern Sie eine Person mit Adresse, damit Sie sie bei Fahrten schnell auswählen können.",
  }),
  makeStub({
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
    ],
    summary:
      "Ein Überblick über die Abrechnung der gefahrenen Transporte.",
  }),
]

/** Driver-specific articles (#86) — still to be written. */
export const driverStubs: HelpArticle[] = [
  makeStub({
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
      "So sehen Sie als Fahrerin oder Fahrer Ihre eingeteilten Fahrten für den Tag.",
  }),
  makeStub({
    slug: "fahrer-verfuegbarkeit",
    title: "Verfügbarkeit eintragen",
    category: "fahrer",
    audience: ["driver"],
    keywords: [
      "verfügbarkeit",
      "arbeitszeit",
      "verfügbar",
      "eintragen",
      "fahrer",
      "zeiten",
    ],
    summary:
      "So teilen Sie mit, wann Sie für Fahrten zur Verfügung stehen.",
  }),
  makeStub({
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
    ],
    summary:
      "So bestätigen oder verweigern Sie eine Ihnen zugewiesene Fahrt.",
  }),
]

/** Administration articles (#86) — still to be written. */
export const adminStubs: HelpArticle[] = [
  makeStub({
    slug: "admin-benutzer",
    title: "Benutzer verwalten",
    category: "administration",
    audience: ["admin"],
    keywords: [
      "benutzer",
      "konto",
      "anlegen",
      "rolle",
      "passwort",
      "verwalten",
      "administration",
    ],
    summary:
      "So legen Sie Konten an, vergeben Rollen und setzen Passwörter zurück.",
  }),
  makeStub({
    slug: "admin-einstellungen",
    title: "Einstellungen und Zonen",
    category: "administration",
    audience: ["admin"],
    keywords: [
      "einstellungen",
      "zonen",
      "konfiguration",
      "administration",
      "system",
    ],
    summary:
      "Ein Überblick über die grundlegenden Einstellungen der App.",
  }),
  makeStub({
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
      "So hinterlegen und pflegen Sie die Tarife für die Preisberechnung.",
  }),
]

/** All placeholder articles combined. */
export const allStubs: HelpArticle[] = [
  ...operatorStubs,
  ...driverStubs,
  ...adminStubs,
]
