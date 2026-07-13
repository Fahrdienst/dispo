import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { getVisibleArticles } from "@/lib/help/filter"
import { getArticleBySlug } from "@/lib/help/content"
import { HelpArticle } from "@/components/help/help-article"
import { BookmarkToggle } from "@/components/help/help-bookmarks"

interface PageProps {
  params: Promise<{ slug: string }>
}

/** Pre-render every public article at build time. */
export function generateStaticParams(): { slug: string }[] {
  return getVisibleArticles(null).map((article) => ({ slug: article.slug }))
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params
  const article = getArticleBySlug(slug)

  if (!article || !article.audience.includes("public")) {
    return { title: "Hilfe | Fahrdienst" }
  }

  return {
    title: `${article.title} | Hilfe`,
    description: article.summary,
  }
}

/**
 * Public article page. Only articles with audience "public" are reachable
 * here; anything else returns 404 (protected content lives under `/hilfe`).
 */
export default async function PublicHelpArticlePage({
  params,
}: PageProps): Promise<React.ReactElement> {
  const { slug } = await params
  const article = getArticleBySlug(slug)

  if (!article || !article.audience.includes("public")) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <Link
        href="/help"
        className="inline-flex items-center gap-1.5 text-base font-medium text-slate-600 transition-colors hover:text-slate-900 print:hidden"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Zurück zur Übersicht
      </Link>

      <HelpArticle
        article={article}
        headerAction={<BookmarkToggle slug={article.slug} />}
      />
    </div>
  )
}
