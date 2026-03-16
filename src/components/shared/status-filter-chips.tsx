"use client"

import { cn } from "@/lib/utils"

interface StatusFilterChipsProps {
  /** Ordered list of status keys to display as chips. */
  statuses: string[]
  /** Map from status key to human-readable label. */
  labels: Record<string, string>
  /** Currently selected value. Use "all" for the "show all" state. */
  value: string
  /** Called when the user clicks a chip. */
  onChange: (value: string) => void
  /** If true, render an "All" chip as the first item. Defaults to true. */
  showAll?: boolean
  /** Label for the "All" chip. Defaults to "Alle". */
  allLabel?: string
  /** Optional count per status, displayed as "(n)" after the label. */
  counts?: Partial<Record<string, number>>
  /**
   * Optional color classes per status key.
   * When a chip is active, these classes are applied (e.g. "bg-blue-100 text-blue-800").
   * When not provided, active chips use the default foreground/background styling.
   */
  colors?: Record<string, string>
  /**
   * Optional dot color classes per status key.
   * When a chip is active and a dot color is provided, a small colored dot is rendered.
   */
  dotColors?: Record<string, string>
}

/**
 * Generic horizontal filter chip bar.
 *
 * Designed for status filtering but works for any enumerated filter dimension
 * (e.g. ride status, driver active/inactive, vehicle type).
 *
 * Scrolls horizontally on mobile; wraps on larger screens.
 */
export function StatusFilterChips({
  statuses,
  labels,
  value,
  onChange,
  showAll = true,
  allLabel = "Alle",
  counts,
  colors,
  dotColors,
}: StatusFilterChipsProps) {
  const totalCount =
    counts != null
      ? Object.values(counts).reduce<number>((sum, c) => sum + (c ?? 0), 0)
      : undefined

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
      {showAll && (
        <button
          type="button"
          onClick={() => onChange("all")}
          className={cn(
            "inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-medium transition-colors",
            value === "all"
              ? "bg-foreground text-background"
              : "border bg-transparent text-muted-foreground hover:bg-muted"
          )}
        >
          {allLabel}
          {totalCount != null && (
            <span className="ml-1 tabular-nums">({totalCount})</span>
          )}
        </button>
      )}

      {statuses.map((status) => {
        const isActive = value === status
        const count = counts?.[status]
        const colorClass = colors?.[status]
        const dotClass = dotColors?.[status]

        return (
          <button
            key={status}
            type="button"
            onClick={() => onChange(status)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
              isActive && colorClass
                ? colorClass
                : isActive
                  ? "bg-foreground text-background"
                  : "border bg-transparent text-muted-foreground hover:bg-muted"
            )}
          >
            {isActive && dotClass && (
              <span className={cn("h-1.5 w-1.5 rounded-full", dotClass)} />
            )}
            {labels[status] ?? status}
            {count != null && (
              <span className="ml-0.5 tabular-nums">({count})</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
