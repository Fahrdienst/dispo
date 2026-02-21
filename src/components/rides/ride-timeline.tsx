"use client"

import { cn } from "@/lib/utils"

interface TimelineEntry {
  label: string
  time: string | null
  isAuto?: boolean
  variant?: "default" | "amber" | "muted"
}

interface RideTimelineProps {
  entries: TimelineEntry[]
  isCalculating?: boolean
}

export function RideTimeline({ entries, isCalculating }: RideTimelineProps) {
  if (isCalculating) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Tagesablauf</h3>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          Route wird berechnet...
        </div>
      </div>
    )
  }

  const visibleEntries = entries.filter((e) => e.time !== null)

  if (visibleEntries.length === 0) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Tagesablauf</h3>
        <p className="text-xs text-muted-foreground">
          Termin- und Abholzeiten eingeben, um den Tagesablauf zu sehen.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Tagesablauf</h3>
      <div className="relative space-y-0">
        {visibleEntries.map((entry, i) => (
          <div key={entry.label} className="flex items-start gap-3">
            {/* Dot + Line */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                  entry.variant === "amber"
                    ? "bg-amber-400"
                    : entry.variant === "muted"
                      ? "bg-muted-foreground/40"
                      : "bg-primary"
                )}
              />
              {i < visibleEntries.length - 1 && (
                <div
                  className="w-px flex-1 bg-border"
                  style={{ minHeight: "28px" }}
                />
              )}
            </div>
            {/* Label + Time */}
            <div className="pb-4">
              <span
                className={cn(
                  "font-mono text-sm font-medium",
                  entry.isAuto && "text-muted-foreground"
                )}
              >
                {entry.time}
                {entry.isAuto && (
                  <span className="ml-1 font-sans text-xs font-normal">
                    (Auto)
                  </span>
                )}
              </span>
              <p className="text-xs text-muted-foreground">{entry.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
