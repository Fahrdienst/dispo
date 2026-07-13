import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth/require-auth"
import { createClient } from "@/lib/supabase/server"
import { getVisibleArticles } from "@/lib/help/filter"
import { buildSearchIndex } from "@/lib/help/search"
import { HelpSearch } from "@/components/help/help-search"
import { HelpOverview } from "@/components/help/help-overview"
import { BookmarkList } from "@/components/help/help-bookmarks"

export const metadata: Metadata = {
  title: "Hilfe | Fahrdienst",
  description: "Ihre persönliche Hilfe, passend zu Ihrer Rolle.",
}

/**
 * Protected, role-aware help hub. Greets the user by name and shows the
 * articles visible to their role (public content plus role-specific content).
 */
export default async function ProtectedHelpHomePage(): Promise<React.ReactElement> {
  const auth = await requireAuth()
  if (!auth.authorized) {
    redirect("/login")
  }

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", auth.userId)
    .single()

  const displayName = profile?.display_name ?? "willkommen"

  const articles = getVisibleArticles(auth.role)
  const searchIndex = buildSearchIndex(articles)
  const bookmarkable = articles.map((article) => ({
    slug: article.slug,
    title: article.title,
    summary: article.summary,
  }))

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Hallo {displayName}
        </h1>
        <p className="max-w-2xl text-lg text-slate-600">
          Hier finden Sie Anleitungen und Antworten, die zu Ihrer Rolle passen.
          Suchen Sie nach einem Stichwort oder wählen Sie ein Thema.
        </p>
        <HelpSearch index={searchIndex} basePath="/hilfe" className="max-w-2xl" />
      </section>

      <BookmarkList articles={bookmarkable} basePath="/hilfe" />

      <HelpOverview articles={articles} basePath="/hilfe" />
    </div>
  )
}
