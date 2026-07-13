"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Bookmark, BookmarkCheck } from "lucide-react"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "help-bookmarks"

/** Minimal shape needed to render a bookmarked article link. */
export interface BookmarkableArticle {
  slug: string
  title: string
  summary: string
}

/** Custom event name used to sync bookmark state across components. */
const SYNC_EVENT = "help-bookmarks-changed"

function readBookmarks(): string[] {
  if (typeof window === "undefined") {
    return []
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return []
    }
    const parsed: unknown = JSON.parse(raw)
    if (
      Array.isArray(parsed) &&
      parsed.every((value): value is string => typeof value === "string")
    ) {
      return parsed
    }
    return []
  } catch {
    return []
  }
}

function writeBookmarks(slugs: string[]): void {
  if (typeof window === "undefined") {
    return
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs))
  window.dispatchEvent(new Event(SYNC_EVENT))
}

/**
 * Hook that exposes the current bookmarks and mutators, kept in sync across
 * components (and browser tabs) via events. `mounted` guards against SSR
 * hydration mismatches — render bookmark UI only once mounted.
 */
function useBookmarks(): {
  bookmarks: string[]
  mounted: boolean
  toggle: (slug: string) => void
  isBookmarked: (slug: string) => boolean
} {
  const [bookmarks, setBookmarks] = useState<string[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setBookmarks(readBookmarks())
    setMounted(true)

    const sync = (): void => setBookmarks(readBookmarks())
    window.addEventListener(SYNC_EVENT, sync)
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener(SYNC_EVENT, sync)
      window.removeEventListener("storage", sync)
    }
  }, [])

  const toggle = useCallback((slug: string): void => {
    setBookmarks((current) => {
      const next = current.includes(slug)
        ? current.filter((value) => value !== slug)
        : [...current, slug]
      writeBookmarks(next)
      return next
    })
  }, [])

  const isBookmarked = useCallback(
    (slug: string): boolean => bookmarks.includes(slug),
    [bookmarks]
  )

  return { bookmarks, mounted, toggle, isBookmarked }
}

interface BookmarkToggleProps {
  slug: string
  className?: string
}

/**
 * Toggle button that adds/removes the current article from the local
 * bookmarks. Purely client-side (localStorage); no database involved.
 */
export function BookmarkToggle({
  slug,
  className,
}: BookmarkToggleProps): React.ReactElement {
  const { mounted, toggle, isBookmarked } = useBookmarks()
  const active = mounted && isBookmarked(slug)

  return (
    <button
      type="button"
      onClick={() => toggle(slug)}
      aria-pressed={active}
      aria-label={active ? "Lesezeichen entfernen" : "Als Lesezeichen merken"}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-base font-medium transition-colors",
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
        className
      )}
    >
      {active ? (
        <BookmarkCheck className="h-5 w-5" aria-hidden />
      ) : (
        <Bookmark className="h-5 w-5" aria-hidden />
      )}
      {active ? "Gemerkt" : "Merken"}
    </button>
  )
}

interface BookmarkListProps {
  /** All candidate articles; only bookmarked ones are shown. */
  articles: BookmarkableArticle[]
  /** Base path for links, e.g. "/help" or "/hilfe". */
  basePath: string
  className?: string
}

/**
 * Renders the user's bookmarked articles. Nothing is rendered before mount or
 * when there are no bookmarks, so the section stays quiet until it is useful.
 */
export function BookmarkList({
  articles,
  basePath,
  className,
}: BookmarkListProps): React.ReactElement | null {
  const { bookmarks, mounted } = useBookmarks()

  if (!mounted) {
    return null
  }

  const bookmarked = articles.filter((article) =>
    bookmarks.includes(article.slug)
  )

  if (bookmarked.length === 0) {
    return null
  }

  return (
    <section className={cn("space-y-4", className)}>
      <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
        <BookmarkCheck className="h-5 w-5 text-primary" aria-hidden />
        Ihre Lesezeichen
      </h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {bookmarked.map((article) => (
          <li key={article.slug}>
            <Link
              href={`${basePath}/${article.slug}`}
              className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <span className="block text-base font-semibold text-slate-900">
                {article.title}
              </span>
              <span className="mt-1 block text-sm text-slate-600">
                {article.summary}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
