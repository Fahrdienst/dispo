/**
 * Shared date utilities for week navigation, formatting, and calculations.
 * Consolidates helpers previously duplicated across rides/page.tsx,
 * dispatch-board.tsx, and dashboard/page.tsx.
 */

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
