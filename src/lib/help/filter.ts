import type { HelpArticle, UserRole } from "@/lib/help/types"
import { ALL_ARTICLES } from "@/lib/help/content"

/**
 * Return the articles a viewer with the given role may see.
 *
 * Rules:
 *  - Public articles (audience includes "public") are always visible.
 *  - `role === null` (signed-out visitor) → only public articles.
 *  - Otherwise → public articles ∪ articles whose audience includes the role.
 *
 * The result preserves the registry order and never contains duplicates
 * (an article is included once, even if it is both public and role-matching).
 */
export function getVisibleArticles(role: UserRole | null): HelpArticle[] {
  return ALL_ARTICLES.filter((article) => {
    if (article.audience.includes("public")) {
      return true
    }
    if (role === null) {
      return false
    }
    return article.audience.includes(role)
  })
}

/**
 * Alias for {@link getVisibleArticles}, expressed from the role's point of
 * view. A signed-out visitor is represented by `null`.
 */
export function getArticlesForRole(role: UserRole | null): HelpArticle[] {
  return getVisibleArticles(role)
}

/**
 * Whether an article with the given slug is visible to the given role.
 * Used by the protected route guard to prevent URL-hopping into content
 * a user is not allowed to see.
 */
export function isArticleVisible(slug: string, role: UserRole | null): boolean {
  return getVisibleArticles(role).some((article) => article.slug === slug)
}
