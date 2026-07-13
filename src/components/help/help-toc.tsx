"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

export interface TocItem {
  id: string
  heading: string
}

interface HelpTocProps {
  items: TocItem[]
}

/**
 * Sticky table of contents with scroll-spy. Highlights the section currently
 * in view via an IntersectionObserver. Hidden on small screens (shown from
 * the `lg` breakpoint), and hidden in print.
 */
export function HelpToc({ items }: HelpTocProps): React.ReactElement | null {
  const [activeId, setActiveId] = useState<string | null>(
    items[0]?.id ?? null
  )

  useEffect(() => {
    if (items.length === 0) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the topmost heading that is currently intersecting.
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)

        if (visible.length > 0 && visible[0]) {
          setActiveId(visible[0].target.id)
        }
      },
      {
        // Trigger when a heading reaches the upper third of the viewport.
        rootMargin: "-80px 0px -66% 0px",
        threshold: 0,
      }
    )

    const elements: HTMLElement[] = []
    for (const item of items) {
      const element = document.getElementById(item.id)
      if (element) {
        observer.observe(element)
        elements.push(element)
      }
    }

    return () => {
      for (const element of elements) {
        observer.unobserve(element)
      }
      observer.disconnect()
    }
  }, [items])

  if (items.length === 0) {
    return null
  }

  return (
    <nav
      aria-label="Inhaltsverzeichnis"
      className="sticky top-8 hidden max-h-[calc(100vh-4rem)] overflow-y-auto lg:block print:hidden"
    >
      <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Auf dieser Seite
      </p>
      <ul className="space-y-1 border-l border-slate-200">
        {items.map((item) => {
          const isActive = item.id === activeId
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={isActive ? "location" : undefined}
                className={cn(
                  "-ml-px block border-l-2 py-1.5 pl-4 text-base transition-colors",
                  isActive
                    ? "border-primary font-semibold text-primary"
                    : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
                )}
              >
                {item.heading}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
