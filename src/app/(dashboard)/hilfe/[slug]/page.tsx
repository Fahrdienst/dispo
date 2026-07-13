import type { Metadata } from "next"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { requireAuth } from "@/lib/auth/require-auth"
import { isArticleVisible } from "@/lib/help/filter"
import { getArticleBySlug } from "@/lib/help/content"
import { HelpArticle } from "@/components/help/help-article"
import { BookmarkToggle } from "@/components/help/help-bookmarks"

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params
  const article = getArticleBySlug(slug)
  return article
    ? { title: `${article.title} | Hilfe`, description: article.summary }
    : { title: "Hilfe | Fahrdienst" }
}

/**
 * Protected article page. The article must be visible to the signed-in user's
 * role, otherwise 404 — this blocks URL-hopping from e.g. a driver into
 * admin-only help content.
 */
export default async function ProtectedHelpArticlePage({
  params,
}: PageProps): Promise<React.ReactElement> {
  const auth = await requireAuth()
  if (!auth.authorized) {
    redirect("/login")
  }

  const { slug } = await params

  // Guard: only render if this article is visible to the user's role.
  if (!isArticleVisible(slug, auth.role)) {
    notFound()
  }

  const article = getArticleBySlug(slug)
  if (!article) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <Link
        href="/hilfe"
        className="inline-flex items-center gap-1.5 text-base font-medium text-slate-600 transition-colors hover:text-slate-900 print:hidden"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Zurück zur Hilfe
      </Link>

      <HelpArticle
        article={article}
        headerAction={<BookmarkToggle slug={article.slug} />}
      />
    </div>
  )
}
