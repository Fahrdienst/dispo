/**
 * Availability resolution (Issue #101).
 *
 * Pure, UI-independent logic that answers a single question:
 * "Which time windows is a driver available for on a given calendar date?"
 *
 * It combines two kinds of `driver_availability` entries:
 *  - Weekly grid entries    (day_of_week set, specific_date NULL)
 *  - Date-specific entries  (specific_date set, day_of_week NULL)
 *
 * Precedence rule (#101):
 *  - If a date has *any* date-specific entry, that date is fully governed by
 *    those entries and the weekly grid is ignored for that date.
 *  - A date-specific "empty exception" (start/end === null) is an explicit
 *    "not available that day" marker: it triggers the override but contributes
 *    no window, so the resolved result is an empty list.
 *
 * This module is deliberately free of DB/React/Next dependencies so it can be
 * unit-tested in isolation and reused by the dispatch side later. The status
 * machine in `src/lib/rides/status-machine.ts` is the model for this style.
 */

import type { Enums } from "@/lib/types/database"

export type Weekday = Enums<"day_of_week">

/** A resolved availability window, always normalized to "HH:MM" 24h strings. */
export interface TimeWindow {
  /** Inclusive start, "HH:MM". */
  start: string
  /** Exclusive end, "HH:MM". */
  end: string
}

/** Recurring weekly availability (day_of_week set, specific_date NULL). */
export interface WeeklyEntry {
  kind: "weekly"
  dayOfWeek: Weekday
  /** "HH:MM" or "HH:MM:SS". */
  start: string
  /** "HH:MM" or "HH:MM:SS". */
  end: string
}

/**
 * Date-specific exception (specific_date set, day_of_week NULL).
 *
 * `start`/`end` === null marks an "empty exception": the driver is explicitly
 * unavailable on `date`, overriding the weekly grid. The current fixed-slot UI
 * cannot persist such a marker (a row always carries a time), but the resolver
 * supports it so dispatch/tests can express "unavailable that day" cleanly.
 */
export interface ExceptionEntry {
  kind: "exception"
  /** ISO calendar date, "YYYY-MM-DD". */
  date: string
  /** "HH:MM" / "HH:MM:SS", or null for an empty (unavailable) marker. */
  start: string | null
  /** "HH:MM" / "HH:MM:SS", or null for an empty (unavailable) marker. */
  end: string | null
}

export type AvailabilityEntry = WeeklyEntry | ExceptionEntry

/** Index 0..6 as returned by Date.getUTCDay() maps to these weekday names. */
const WEEKDAY_BY_INDEX: readonly Weekday[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
]

/**
 * Weekday name for an ISO "YYYY-MM-DD" date, computed in UTC so the result is
 * independent of the machine timezone.
 *
 * @throws if `date` is not a valid "YYYY-MM-DD" calendar date.
 */
export function weekdayOf(date: string): Weekday {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid date (expected YYYY-MM-DD): ${date}`)
  }
  const timestamp = Date.parse(`${date}T00:00:00Z`)
  if (Number.isNaN(timestamp)) {
    throw new Error(`Invalid date: ${date}`)
  }
  const index = new Date(timestamp).getUTCDay()
  // Index is always 0..6 here, but keep the code total for the type checker.
  return WEEKDAY_BY_INDEX[index] ?? "sunday"
}

/** Parse "HH:MM" or "HH:MM:SS" into minutes since midnight. */
function toMinutes(time: string): number {
  const parts = time.split(":")
  const hours = Number(parts[0])
  const minutes = Number(parts[1] ?? "0")
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    throw new Error(`Invalid time: ${time}`)
  }
  return hours * 60 + minutes
}

/** Format minutes since midnight back to a "HH:MM" string. */
function toHHMM(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

/**
 * Sort windows by start, drop zero/negative-length ones, and merge any that
 * overlap or touch (end === next start) into contiguous windows. Produces a
 * canonical, non-overlapping, ascending list.
 */
function normalizeWindows(
  windows: readonly { start: string; end: string }[]
): TimeWindow[] {
  const ranges = windows
    .map((w) => ({ start: toMinutes(w.start), end: toMinutes(w.end) }))
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start || a.end - b.end)

  const merged: { start: number; end: number }[] = []
  for (const range of ranges) {
    const last = merged[merged.length - 1]
    if (last && range.start <= last.end) {
      // Overlapping or adjacent -> extend the current window.
      last.end = Math.max(last.end, range.end)
    } else {
      merged.push({ ...range })
    }
  }

  return merged.map((r) => ({ start: toHHMM(r.start), end: toHHMM(r.end) }))
}

/**
 * Resolve the effective availability windows for `date`.
 *
 * @param date    Target date as "YYYY-MM-DD".
 * @param entries All availability entries for one driver (weekly + exceptions).
 * @returns Canonical, merged, ascending list of windows. Empty means the driver
 *          is not available that day.
 */
export function resolveAvailability(
  date: string,
  entries: readonly AvailabilityEntry[]
): TimeWindow[] {
  const exceptionsForDate = entries.filter(
    (entry): entry is ExceptionEntry =>
      entry.kind === "exception" && entry.date === date
  )

  // Precedence: any exception for this date fully overrides the weekly grid.
  if (exceptionsForDate.length > 0) {
    const windows = exceptionsForDate
      .filter(
        (entry): entry is ExceptionEntry & { start: string; end: string } =>
          entry.start !== null && entry.end !== null
      )
      .map((entry) => ({ start: entry.start, end: entry.end }))
    return normalizeWindows(windows)
  }

  // No exception -> fall back to the recurring weekly grid.
  const weekday = weekdayOf(date)
  const windows = entries
    .filter(
      (entry): entry is WeeklyEntry =>
        entry.kind === "weekly" && entry.dayOfWeek === weekday
    )
    .map((entry) => ({ start: entry.start, end: entry.end }))
  return normalizeWindows(windows)
}

/**
 * Convenience mapper: turn raw `driver_availability` rows (as loaded from
 * Supabase) into `AvailabilityEntry[]` for `resolveAvailability`. Rows with a
 * `day_of_week` become weekly entries; rows with a `specific_date` become
 * exception entries. Rows with neither (should not happen given the
 * `exactly_one_schedule_type` constraint) are skipped.
 */
export function toAvailabilityEntries(
  rows: readonly {
    day_of_week: Weekday | null
    specific_date: string | null
    start_time: string
    end_time: string
  }[]
): AvailabilityEntry[] {
  const entries: AvailabilityEntry[] = []
  for (const row of rows) {
    if (row.day_of_week !== null) {
      entries.push({
        kind: "weekly",
        dayOfWeek: row.day_of_week,
        start: row.start_time,
        end: row.end_time,
      })
    } else if (row.specific_date !== null) {
      entries.push({
        kind: "exception",
        date: row.specific_date,
        start: row.start_time,
        end: row.end_time,
      })
    }
  }
  return entries
}
