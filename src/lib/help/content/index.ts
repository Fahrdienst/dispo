import type { HelpArticle } from "@/lib/help/types"
import { appUebersicht } from "@/lib/help/content/app-uebersicht"
import { ersteSchritte } from "@/lib/help/content/erste-schritte"
import { faq } from "@/lib/help/content/faq"
import { kontakt } from "@/lib/help/content/kontakt"
import { fahrtErfassen } from "@/lib/help/content/fahrt-erfassen"
import { fahrerZuweisen } from "@/lib/help/content/fahrer-zuweisen"
import { serieAnlegen } from "@/lib/help/content/serie-anlegen"
import { dispatchBoard } from "@/lib/help/content/dispatch-board"
import { patientAnlegen } from "@/lib/help/content/patient-anlegen"
import { abrechnung } from "@/lib/help/content/abrechnung"
import { fahrerMeineFahrten } from "@/lib/help/content/fahrer-meine-fahrten"
import { fahrerVerfuegbarkeit } from "@/lib/help/content/fahrer-verfuegbarkeit"
import { fahrerFahrtAnnehmen } from "@/lib/help/content/fahrer-fahrt-annehmen"
import { adminBenutzer } from "@/lib/help/content/admin-benutzer"
import { adminEinstellungen } from "@/lib/help/content/admin-einstellungen"
import { adminTarife } from "@/lib/help/content/admin-tarife"

/**
 * The single registry of all help articles. Every surface (public pages,
 * protected pages, search index, static params) derives from this array.
 *
 * Order here is the natural reading order; overview pages regroup by category.
 */
export const ALL_ARTICLES: HelpArticle[] = [
  // Grundlagen
  appUebersicht,
  ersteSchritte,
  // Operator-/Admin-Tutorials: Fahrten erfassen und planen
  fahrtErfassen,
  serieAnlegen,
  dispatchBoard,
  fahrerZuweisen,
  patientAnlegen,
  abrechnung,
  // Für Fahrerinnen und Fahrer
  fahrerMeineFahrten,
  fahrerVerfuegbarkeit,
  fahrerFahrtAnnehmen,
  // Administration
  adminBenutzer,
  adminEinstellungen,
  adminTarife,
  // Hilfe und Kontakt
  faq,
  kontakt,
]

/** Look up a single article by its slug. Returns null if not found. */
export function getArticleBySlug(slug: string): HelpArticle | null {
  return ALL_ARTICLES.find((article) => article.slug === slug) ?? null
}
