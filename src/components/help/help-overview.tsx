import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type HelpArticle,
  type HelpCategory,
} from "@/lib/help/types"
import { HelpCard } from "@/components/help/help-card"
import { getCategoryIcon } from "@/components/help/category-icon"

interface HelpOverviewProps {
  articles: HelpArticle[]
  /** Base path for article links, e.g. "/help" or "/hilfe". */
  basePath: string
}

/**
 * Groups articles by category (in the canonical order) and renders each group
 * as a labelled section of large topic cards. Empty categories are skipped.
 */
export function HelpOverview({
  articles,
  basePath,
}: HelpOverviewProps): React.ReactElement {
  const byCategory = new Map<HelpCategory, HelpArticle[]>()
  for (const article of articles) {
    const existing = byCategory.get(article.category)
    if (existing) {
      existing.push(article)
    } else {
      byCategory.set(article.category, [article])
    }
  }

  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    items: byCategory.get(category) ?? [],
  })).filter((group) => group.items.length > 0)

  return (
    <div className="space-y-10">
      {groups.map((group) => (
        <section key={group.category} className="space-y-4">
          <h2 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-slate-900">
            <span className="text-primary">
              {getCategoryIcon(group.category)}
            </span>
            {CATEGORY_LABELS[group.category]}
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {group.items.map((article) => (
              <HelpCard
                key={article.slug}
                href={`${basePath}/${article.slug}`}
                title={article.title}
                description={article.summary}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
