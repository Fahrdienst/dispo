import type { Metadata } from "next"
import { getVisibleArticles } from "@/lib/help/filter"
import { buildSearchIndex } from "@/lib/help/search"
import { HelpSearch } from "@/components/help/help-search"
import { HelpOverview } from "@/components/help/help-overview"
import { BookmarkList } from "@/components/help/help-bookmarks"

export const metadata: Metadata = {
  title: "Hilfe & Anleitungen | Fahrdienst",
  description:
    "Verständliche Anleitungen und Antworten rund um die Fahrdienst-App – Schritt für Schritt erklärt.",
}

/**
 * Public help home. Shows a hero, the search field and topic cards built from
 * the public-only article set (`getVisibleArticles(null)`).
 */
export default function PublicHelpHomePage(): React.ReactElement {
  const articles = getVisibleArticles(null)
  const searchIndex = buildSearchIndex(articles)
  const bookmarkable = articles.map((article) => ({
    slug: article.slug,
    title: article.title,
    summary: article.summary,
  }))

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">
          Wie können wir Ihnen helfen?
        </h1>
        <p className="max-w-2xl text-lg text-slate-600">
          Hier finden Sie einfache Anleitungen und Antworten rund um die
          Fahrdienst-App. Suchen Sie nach einem Stichwort oder wählen Sie unten
          ein Thema.
        </p>
        <HelpSearch index={searchIndex} basePath="/help" className="max-w-2xl" />
      </section>

      <BookmarkList articles={bookmarkable} basePath="/help" />

      <HelpOverview articles={articles} basePath="/help" />
    </div>
  )
}
