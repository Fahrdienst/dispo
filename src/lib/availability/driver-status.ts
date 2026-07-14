/**
 * Driver availability + absence status (Issue #104).
 *
 * Pure, UI-independent glue on top of `resolveAvailability` (the single source
 * of truth for availability windows, #101). It answers the two questions the
 * dispatch/assignment surfaces need:
 *
 *   1. Is the driver on an *approved* absence covering the ride date? ("Ferien")
 *   2. Does the ride's pickup time fall inside the driver's resolved
 *      availability windows for that date?
 *
 * This module is free of DB/React/Next dependencies so it can run both in the
 * dispatch UI (reactive, client-side) and in server actions (validation).
 */

import {
  resolveAvailability,
  toAvailabilityEntries,
  type TimeWindow,
  type Weekday,
} from "@/lib/availability/resolve"
import type { Enums } from "@/lib/types/database"

/** Raw `driver_availability` row shape needed to resolve windows. */
export interface AvailabilityRow {
  day_of_week: Weekday | null
  specific_date: string | null
  start_time: string
  end_time: string
}

/** An approved absence period (inclusive date range). */
export interface AbsenceRange {
  start_date: string
  end_date: string
  type: Enums<"absence_type">
}

/** Bundled per-driver schedule, as shipped to the ride form for reactive checks. */
export interface DriverSchedule {
  driverId: string
  availability: AvailabilityRow[]
  absences: AbsenceRange[]
}

/** Resolved status of a single driver for a single date (and optional time). */
export interface DriverDayStatus {
  /** Driver has an approved absence covering the date. */
  isAbsent: boolean
  /** Type of the covering absence, if any. */
  absenceType: Enums<"absence_type"> | null
  /** Resolved availability windows for the date. */
  windows: TimeWindow[]
  /** Whether the driver has any availability window that day. */
  hasAvailability: boolean
  /**
   * Whether the pickup time falls inside a window. When no time is supplied,
   * this is `true` (there is nothing to warn about yet).
   */
  isWithinAvailability: boolean
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Return the first approved absence range that covers `date`, or null.
 * ISO date strings compare lexically, so string comparison is exact here.
 */
export function findAbsenceOn(
  date: string,
  absences: readonly AbsenceRange[]
): AbsenceRange | null {
  if (!ISO_DATE.test(date)) return null
  for (const absence of absences) {
    if (date >= absence.start_date && date <= absence.end_date) {
      return absence
    }
  }
  return null
}

/**
 * Whether `time` (HH:MM[:SS]) falls inside any window. Windows are inclusive
 * of start and exclusive of end, matching `resolveAvailability`'s contract.
 */
export function isTimeWithinWindows(
  time: string,
  windows: readonly TimeWindow[]
): boolean {
  const hhmm = time.slice(0, 5)
  return windows.some(
    (w) => hhmm >= w.start.slice(0, 5) && hhmm < w.end.slice(0, 5)
  )
}

/**
 * Resolve a driver's absence + availability status for a given date/time.
 *
 * @param date       Target date "YYYY-MM-DD".
 * @param time       Pickup time "HH:MM[:SS]" or null/"" when not yet chosen.
 * @param availability Raw availability rows for the driver.
 * @param absences   Approved absence ranges for the driver.
 */
export function resolveDriverDayStatus(
  date: string,
  time: string | null,
  availability: readonly AvailabilityRow[],
  absences: readonly AbsenceRange[]
): DriverDayStatus {
  const absence = findAbsenceOn(date, absences)

  const windows = ISO_DATE.test(date)
    ? resolveAvailability(date, toAvailabilityEntries([...availability]))
    : []

  const hasAvailability = windows.length > 0
  const isWithinAvailability =
    time == null || time === "" ? true : isTimeWithinWindows(time, windows)

  return {
    isAbsent: absence !== null,
    absenceType: absence?.type ?? null,
    windows,
    hasAvailability,
    isWithinAvailability,
  }
}
