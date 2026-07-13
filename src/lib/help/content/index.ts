import type { HelpArticle } from "@/lib/help/types"
import { appUebersicht } from "@/lib/help/content/app-uebersicht"
import { ersteSchritte } from "@/lib/help/content/erste-schritte"
import { faq } from "@/lib/help/content/faq"
import { kontakt } from "@/lib/help/content/kontakt"
import { fahrtErfassen } from "@/lib/help/content/fahrt-erfassen"
import { allStubs } from "@/lib/help/content/stubs"

/**
 * The single registry of all help articles. Every surface (public pages,
 * protected pages, search index, static params) derives from this array.
 *
 * Order here is the natural reading order; overview pages regroup by category.
 */
export const ALL_ARTICLES: HelpArticle[] = [
  appUebersicht,
  ersteSchritte,
  fahrtErfassen,
  faq,
  kontakt,
  ...allStubs,
]

/** Look up a single article by its slug. Returns null if not found. */
export function getArticleBySlug(slug: string): HelpArticle | null {
  return ALL_ARTICLES.find((article) => article.slug === slug) ?? null
}
