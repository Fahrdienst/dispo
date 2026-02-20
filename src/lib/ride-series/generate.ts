import type { Enums } from "@/lib/types/database"

type DayOfWeek = Enums<"day_of_week">
type RecurrenceType = Enums<"recurrence_type">
type RideDirection = Enums<"ride_direction">

/** Minimal series data needed for date generation. */
export interface SeriesForGeneration {
  recurrence_type: RecurrenceType
  days_of_week: DayOfWeek[] | null
  start_date: string // YYYY-MM-DD
  end_date: string | null // YYYY-MM-DD
}

const JS_DAY_TO_ENUM: Record<number, DayOfWeek> = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
}

/**
 * Returns the ISO week number for a given date.
 * Used for biweekly parity calculation.
 */
function getISOWeekNumber(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  )
  // Set to nearest Thursday: current date + 4 - current day number (Mon=1, Sun=7)
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

/**
 * Parse a YYYY-MM-DD string into a Date (local midnight, UTC-safe).
 * All date arithmetic uses this to avoid timezone drift.
 */
function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number)
  return new Date(year!, month! - 1, day!)
}

/** Format a Date back to YYYY-MM-DD. */
function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/**
 * Generate all dates for a ride series within a given range.
 *
 * The effective range is clamped to:
 *   [max(fromDate, series.start_date), min(toDate, series.end_date ?? toDate)]
 *
 * @returns Array of YYYY-MM-DD strings.
 */
export function generateDatesForSeries(
  series: SeriesForGeneration,
  fromDate: string,
  toDate: string
): string[] {
  // Clamp the effective range
  const effectiveFrom = fromDate > series.start_date ? fromDate : series.start_date
  const effectiveTo =
    series.end_date && series.end_date < toDate ? series.end_date : toDate

  if (effectiveFrom > effectiveTo) {
    return []
  }

  const startDate = parseDate(effectiveFrom)
  const endDate = parseDate(effectiveTo)
  const dates: string[] = []

  switch (series.recurrence_type) {
    case "daily": {
      const current = new Date(startDate)
      while (current <= endDate) {
        dates.push(formatDate(current))
        current.setDate(current.getDate() + 1)
      }
      break
    }

    case "weekly": {
      const allowedDays = new Set(series.days_of_week ?? [])
      const current = new Date(startDate)
      while (current <= endDate) {
        const dayName = JS_DAY_TO_ENUM[current.getDay()]
        if (dayName && allowedDays.has(dayName)) {
          dates.push(formatDate(current))
        }
        current.setDate(current.getDate() + 1)
      }
      break
    }

    case "biweekly": {
      const allowedDays = new Set(series.days_of_week ?? [])
      const seriesStart = parseDate(series.start_date)
      const startWeekParity = getISOWeekNumber(seriesStart) % 2

      const current = new Date(startDate)
      while (current <= endDate) {
        const dayName = JS_DAY_TO_ENUM[current.getDay()]
        const currentWeekParity = getISOWeekNumber(current) % 2
        if (
          dayName &&
          allowedDays.has(dayName) &&
          currentWeekParity === startWeekParity
        ) {
          dates.push(formatDate(current))
        }
        current.setDate(current.getDate() + 1)
      }
      break
    }

    case "monthly": {
      const seriesStartDate = parseDate(series.start_date)
      const targetDay = seriesStartDate.getDate()

      // Start from the month of effectiveFrom
      const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
      while (current <= endDate) {
        // Set to the target day, but check if it exists in this month
        const daysInMonth = new Date(
          current.getFullYear(),
          current.getMonth() + 1,
          0
        ).getDate()

        if (targetDay <= daysInMonth) {
          const candidate = new Date(
            current.getFullYear(),
            current.getMonth(),
            targetDay
          )
          if (candidate >= startDate && candidate <= endDate) {
            dates.push(formatDate(candidate))
          }
        }
        // Move to next month
        current.setMonth(current.getMonth() + 1)
      }
      break
    }
  }

  return dates
}

/**
 * Expand a direction value into the concrete directions for individual rides.
 * "both" produces two entries: outbound + return.
 */
export function expandDirections(
  direction: RideDirection
): ("outbound" | "return")[] {
  if (direction === "both") {
    return ["outbound", "return"]
  }
  // direction is either "outbound" or "return" here
  return [direction as "outbound" | "return"]
}
