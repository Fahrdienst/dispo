"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { CATEGORY_LABELS } from "@/lib/help/types"
import {
  searchArticles,
  type SearchIndexEntry,
} from "@/lib/help/search"

interface HelpSearchProps {
  /** Serializable search index built on the server. */
  index: SearchIndexEntry[]
  /** Base path for result links, e.g. "/help" or "/hilfe". */
  basePath: string
  className?: string
}

/**
 * Accessible search field with a live result list. Receives the pre-built,
 * serializable index as a prop so no data fetching happens on the client.
 */
export function HelpSearch({
  index,
  basePath,
  className,
}: HelpSearchProps): React.ReactElement {
  const [query, setQuery] = useState("")

  const results = useMemo(
    () => searchArticles(index, query),
    [index, query]
  )

  const trimmed = query.trim()
  const hasQuery = trimmed.length > 0

  return (
    <div className={cn("w-full", className)}>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <input
          type="search"
          role="searchbox"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Hilfe durchsuchen…"
          aria-label="Hilfe durchsuchen"
          className={cn(
            "h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-lg shadow-sm",
            "placeholder:text-slate-400",
            "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          )}
        />
      </div>

      {hasQuery && (
        <div className="mt-3" aria-live="polite">
          {results.length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-base text-slate-600">
              Keine Ergebnisse für „{trimmed}“. Versuchen Sie ein anderes Wort.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {results.map((entry) => (
                <li key={entry.slug}>
                  <Link
                    href={`${basePath}/${entry.slug}`}
                    className="block px-4 py-3 transition-colors hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                  >
                    <span className="block text-base font-semibold text-slate-900">
                      {entry.title}
                    </span>
                    <span className="mt-0.5 block text-sm text-slate-500">
                      {CATEGORY_LABELS[entry.category]}
                    </span>
                    <span className="mt-1 block text-sm text-slate-600">
                      {entry.snippet}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
