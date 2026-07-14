"use client"

// SLOT (#136): Wiederhol-/Serien-Toggle.
// Functional stub: renders a labeled placeholder and the hidden `enable_series`
// input the server action reads to branch into series creation. Issue #136 adds
// the full recurrence UI (type, weekdays, end date, preview) on top of the same
// props contract — the core owns all series state and passes setters down.

import { Repeat } from "lucide-react"

export interface SeriesToggleProps {
  /** Whether the ride should be created as a recurring series. */
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  /** Recurrence type: daily | weekly | biweekly | monthly. */
  recurrenceType: string
  onRecurrenceTypeChange: (value: string) => void
  /** Selected weekdays (for weekly/biweekly). */
  daysOfWeek: string[]
  onDaysOfWeekChange: (days: string[]) => void
  /** Optional ISO end date for the series. */
  endDate: string
  onEndDateChange: (value: string) => void
  /** Current ride direction (drives the generated-count preview in #136). */
  direction: string
}

export function SeriesToggle({ enabled }: SeriesToggleProps) {
  return (
    <div className="space-y-2">
      {/* Hidden field consumed by createRide to branch into series creation. */}
      <input type="hidden" name="enable_series" value={enabled ? "true" : ""} />
      <div className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
        <Repeat className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>Serien-/Wiederhol-Optionen folgen (#136)</span>
      </div>
    </div>
  )
}
