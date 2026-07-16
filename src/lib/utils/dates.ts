/**
 * Shared date utilities for week navigation, formatting, and calculations.
 * Consolidates helpers previously duplicated across rides/page.tsx,
 * dispatch-board.tsx, and dashboard/page.tsx.
 */

/** IANA timezone the business operates in. Ride dates/times are wall-clock in this zone. */
export const APP_TIME_ZONE = "Europe/Zurich"

/**
 * Offset in milliseconds between the given timezone and UTC at a specific instant.
 * Positive when the zone is ahead of UTC (e.g. +1h CET, +2h CEST).
 */
function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  // `toLocaleString` re-renders the instant as wall-clock text in each zone;
  // re-parsing both as local Dates and subtracting yields the zone offset.
  const utcWall = new Date(instant.toLocaleString("en-US", { timeZone: "UTC" }))
  const zoneWall = new Date(instant.toLocaleString("en-US", { timeZone }))
  return zoneWall.getTime() - utcWall.getTime()
}

/**
 * Interpret a naive date + time as Europe/Zurich wall-clock time and return the
 * corresponding absolute instant (a UTC Date). DST (CET/CEST) is handled via the
 * Intl timezone database, so callers must never assume a fixed +1/+2h offset.
 *
 * Server runtimes (Vercel) run in UTC, so parsing `new Date("2026-03-05T10:00:00")`
 * would silently mislabel a Zurich ride by the zone offset — this helper fixes that.
 *
 * @param dateStr YYYY-MM-DD
 * @param timeStr HH:mm or HH:mm:ss
 */
export function zurichWallTimeToUtc(dateStr: string, timeStr: string): Date {
  // Treat the wall time as if it were UTC, then subtract the real zone offset.
  // Using the offset at this (approximate) instant is exact except within the
  // ~1h DST transition windows, which is irrelevant for our hour-scale SLAs.
  const asIfUtc = new Date(`${dateStr}T${timeStr}Z`)
  const offsetMs = timeZoneOffsetMs(asIfUtc, APP_TIME_ZONE)
  return new Date(asIfUtc.getTime() - offsetMs)
}

/** Get today as YYYY-MM-DD. */
export function getToday(): string {
  return new Date().toISOString().split("T")[0]!
}

/** Add/subtract N days from a date string (YYYY-MM-DD). */
export function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + "T00:00:00")
  date.setDate(date.getDate() + days)
  return date.toISOString().split("T")[0]!
}

/** Get the Monday (start of week) for the week containing dateStr. */
export function getMondayOf(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  const jsDay = d.getDay() // 0=Sun
  const diffToMonday = jsDay === 0 ? -6 : 1 - jsDay
  const monday = new Date(d)
  monday.setDate(d.getDate() + diffToMonday)
  return monday.toISOString().split("T")[0]!
}

/** Get the Sunday (end of week) for the week containing dateStr. */
export function getSundayOf(dateStr: string): string {
  const monday = getMondayOf(dateStr)
  return addDays(monday, 6)
}

/** Format "2026-02-23" as "Mo., 23. Feb. 2026" (full format). */
export function formatDateDE(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00")
  return date.toLocaleDateString("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

const WEEKDAY_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"] as const

/** Format "2026-02-23" as "Mo 23.02." for compact day labels. */
export function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  const wd = WEEKDAY_SHORT[d.getDay()]!
  const day = String(d.getDate()).padStart(2, "0")
  const month = String(d.getMonth() + 1).padStart(2, "0")
  return `${wd} ${day}.${month}.`
}

/** Format a week range: "Mo 23.02. – So 01.03.2026" */
export function formatWeekRange(weekStart: string): string {
  const weekEnd = addDays(weekStart, 6)
  const startLabel = formatDayLabel(weekStart)
  const endDate = new Date(weekEnd + "T00:00:00")
  const endWd = WEEKDAY_SHORT[endDate.getDay()]!
  const endDay = String(endDate.getDate()).padStart(2, "0")
  const endMonth = String(endDate.getMonth() + 1).padStart(2, "0")
  const endYear = endDate.getFullYear()
  return `${startLabel} \u2013 ${endWd} ${endDay}.${endMonth}.${endYear}`
}

/**
 * Build an array of 7 date strings (Mon–Sun) for the week starting at weekStart.
 * weekStart must be a Monday.
 */
export function getWeekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}
