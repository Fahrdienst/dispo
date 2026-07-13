import type { HelpArticle, HelpCategory } from "@/lib/help/types"

/**
 * Lightweight, pure, client-usable search over the help registry.
 *
 * The index is a plain, serializable array so it can be built on the server
 * and passed as a prop into a Client Component without any runtime cost.
 */

/** A single serializable search entry. Safe to send to the client. */
export interface SearchIndexEntry {
  slug: string
  title: string
  category: HelpCategory
  /** Original keywords plus section headings, for matching. */
  keywords: string[]
  /** Short summary shown in the result list. */
  snippet: string
}

/**
 * Normalize a string for umlaut-tolerant matching:
 *  - lowercased
 *  - German umlaut equivalences (ä→a, ö→o, ü→u, ß→ss)
 *  - diacritics stripped via NFD
 */
export function normalizeForSearch(input: string): string {
  return input
    .toLowerCase()
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
}

/**
 * Build a serializable search index from a list of articles.
 * Section headings are folded into the keywords so headings remain
 * searchable on the client without shipping full article bodies.
 */
export function buildSearchIndex(articles: HelpArticle[]): SearchIndexEntry[] {
  return articles.map((article) => ({
    slug: article.slug,
    title: article.title,
    category: article.category,
    keywords: [
      ...article.keywords,
      ...article.sections.map((section) => section.heading),
    ],
    snippet: article.summary,
  }))
}

/**
 * Score a single entry against already-normalized query tokens.
 * Every token must match somewhere (AND semantics); the returned score
 * weights title matches highest, then keywords, then the snippet.
 * Returns 0 when not all tokens match.
 */
function scoreEntry(entry: SearchIndexEntry, tokens: string[]): number {
  const title = normalizeForSearch(entry.title)
  const keywords = entry.keywords.map(normalizeForSearch)
  const snippet = normalizeForSearch(entry.snippet)

  let total = 0
  for (const token of tokens) {
    let best = 0
    if (title.includes(token)) {
      best = title.startsWith(token) ? 4 : 3
    } else if (keywords.some((keyword) => keyword.includes(token))) {
      best = 2
    } else if (snippet.includes(token)) {
      best = 1
    }
    if (best === 0) {
      // A required token did not match anywhere → exclude this entry.
      return 0
    }
    total += best
  }
  return total
}

/**
 * Search the index for a query string. Returns matching entries sorted by
 * relevance (best first), then alphabetically by title. An empty query
 * returns an empty result list.
 */
export function searchArticles(
  index: SearchIndexEntry[],
  query: string
): SearchIndexEntry[] {
  const tokens = normalizeForSearch(query).split(/\s+/).filter(Boolean)
  if (tokens.length === 0) {
    return []
  }

  return index
    .map((entry) => ({ entry, score: scoreEntry(entry, tokens) }))
    .filter((result) => result.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score
      }
      return a.entry.title.localeCompare(b.entry.title, "de")
    })
    .map((result) => result.entry)
}
