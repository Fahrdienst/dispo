/**
 * Server-side driver assignment support (Issue #104).
 *
 * Loads availability + absence data in a *bundled* fashion (one query per
 * table, resolved per driver in JS -- no N+1) and provides the guards used
 * when a driver is assigned to a ride:
 *
 *   - `loadDriverSchedules`  -> raw per-driver schedules for the ride form
 *     (client resolves reactively as date/time change).
 *   - `getDriverDayStatus`   -> resolved status for a single driver/date/time,
 *     used by the ride + dispatch server actions to block absent drivers and
 *     detect out-of-availability assignments.
 *   - `logOutsideAvailabilityAssignment` -> writes a `communication_log` note
 *     documenting an override, following the existing addMessage pattern.
 */

import "server-only"

import type { createClient } from "@/lib/supabase/server"
import { weekdayOf, type Weekday } from "@/lib/availability/resolve"
import {
  resolveDriverDayStatus,
  type AvailabilityRow,
  type AbsenceRange,
  type DriverSchedule,
  type DriverDayStatus,
} from "@/lib/availability/driver-status"

type ServerClient = Awaited<ReturnType<typeof createClient>>

export type { DriverSchedule, DriverDayStatus }

/**
 * Bundled loader: fetch availability + approved absences for many drivers at
 * once (one query per table). Rows are grouped per driver in memory so the
 * caller can resolve status client-side for any date. No N+1.
 *
 * @param today Lower bound used to skip stale past date-exceptions/absences.
 */
export async function loadDriverSchedules(
  supabase: ServerClient,
  driverIds: string[],
  today: string
): Promise<DriverSchedule[]> {
  if (driverIds.length === 0) return []

  const [availRes, absenceRes] = await Promise.all([
    supabase
      .from("driver_availability")
      .select("driver_id, day_of_week, specific_date, start_time, end_time")
      .in("driver_id", driverIds)
      // Keep all recurring weekly rows, but drop past one-off exceptions.
      .or(`day_of_week.not.is.null,specific_date.gte.${today}`),
    supabase
      .from("driver_absences")
      .select("driver_id, start_date, end_date, type")
      .in("driver_id", driverIds)
      .eq("status", "approved")
      .gte("end_date", today),
  ])

  const byDriver = new Map<string, DriverSchedule>()
  for (const id of driverIds) {
    byDriver.set(id, { driverId: id, availability: [], absences: [] })
  }

  for (const row of availRes.data ?? []) {
    byDriver.get(row.driver_id)?.availability.push({
      day_of_week: row.day_of_week,
      specific_date: row.specific_date,
      start_time: row.start_time,
      end_time: row.end_time,
    })
  }

  for (const row of absenceRes.data ?? []) {
    byDriver.get(row.driver_id)?.absences.push({
      start_date: row.start_date,
      end_date: row.end_date,
      type: row.type,
    })
  }

  return [...byDriver.values()]
}

/**
 * Resolve absence + availability status for a single driver on a specific
 * date/time. Scoped to the exact date (independent of "today") so it stays
 * correct even for back-dated rides. Two focused queries.
 */
export async function getDriverDayStatus(
  supabase: ServerClient,
  driverId: string,
  date: string,
  pickupTime: string
): Promise<DriverDayStatus> {
  let weekday: Weekday | null = null
  try {
    weekday = weekdayOf(date)
  } catch {
    weekday = null
  }

  // Only the rows relevant to this date: matching weekly grid entry(ies) plus
  // any date-specific exception. resolveAvailability applies the precedence.
  const orFilter = weekday
    ? `and(day_of_week.eq.${weekday},specific_date.is.null),specific_date.eq.${date}`
    : `specific_date.eq.${date}`

  const [availRes, absenceRes] = await Promise.all([
    supabase
      .from("driver_availability")
      .select("day_of_week, specific_date, start_time, end_time")
      .eq("driver_id", driverId)
      .or(orFilter),
    supabase
      .from("driver_absences")
      .select("type")
      .eq("driver_id", driverId)
      .eq("status", "approved")
      .lte("start_date", date)
      .gte("end_date", date),
  ])

  const availability: AvailabilityRow[] = (availRes.data ?? []).map((r) => ({
    day_of_week: r.day_of_week,
    specific_date: r.specific_date,
    start_time: r.start_time,
    end_time: r.end_time,
  }))
  const absences: AbsenceRange[] = (absenceRes.data ?? []).map((a) => ({
    start_date: date,
    end_date: date,
    type: a.type,
  }))

  return resolveDriverDayStatus(date, pickupTime, availability, absences)
}

/**
 * Record an out-of-availability assignment in the ride's communication_log.
 * Best-effort: logs the error but never throws (must not break assignment).
 */
export async function logOutsideAvailabilityAssignment(
  supabase: ServerClient,
  params: {
    rideId: string
    authorId: string
    pickupTime: string
    hasAvailability: boolean
  }
): Promise<void> {
  const reason = params.hasAvailability
    ? "ausserhalb der eingetragenen Verfuegbarkeit"
    : "ohne hinterlegte Verfuegbarkeit an diesem Tag"
  const message = `Fahrer ${reason} zugewiesen (Abholung ${params.pickupTime.slice(
    0,
    5
  )} Uhr).`

  const { error } = await supabase.from("communication_log").insert({
    ride_id: params.rideId,
    author_id: params.authorId,
    message,
  })

  if (error) {
    console.error(
      "Failed to log out-of-availability assignment:",
      error.message
    )
  }
}
