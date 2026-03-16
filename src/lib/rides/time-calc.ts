/**
 * Ride Time Calculation Service
 *
 * Pure functions for computing suggested pickup times based on
 * appointment times and route duration. No side effects, no Supabase.
 *
 * Phase 1.1 of the Maps & Time Calculation milestone.
 */

import {
  addMinutesToTime,
  subtractMinutesFromTime,
  DEFAULT_PICKUP_BUFFER_MINUTES,
  DEFAULT_RETURN_BUFFER_MINUTES,
} from "@/lib/validations/rides"

export { DEFAULT_PICKUP_BUFFER_MINUTES }

export interface RideTimeCalcInputs {
  /** Appointment start time in "HH:MM" format, or null if unknown */
  appointment_time: string | null
  /** Appointment end time in "HH:MM" format, or null if unknown */
  appointment_end_time: string | null
  /** Route duration in seconds (from route calculation), or null if not yet calculated */
  duration_seconds: number | null
  /** Buffer minutes before drive duration (default: DEFAULT_PICKUP_BUFFER_MINUTES) */
  pickupBufferMinutes?: number
  /** Buffer minutes after appointment end for return pickup (default: DEFAULT_RETURN_BUFFER_MINUTES) */
  returnBufferMinutes?: number
}

export interface RideTimeCalcResult {
  /** Suggested outbound pickup time in "HH:MM", or null if inputs missing or result before 00:00 */
  suggestedPickupTime: string | null
  /** Suggested return pickup time in "HH:MM", or null if inputs missing or result after 23:59 */
  suggestedReturnPickupTime: string | null
}

/**
 * Calculate suggested pickup times for a ride.
 *
 * Outbound: appointment_time - ceil(duration_seconds / 60) - pickupBufferMinutes
 * Return:   appointment_end_time + returnBufferMinutes
 *
 * Returns null for either value if the required inputs are missing
 * or if the result falls outside the valid 00:00-23:59 range.
 */
export function calculateRideTimes(inputs: RideTimeCalcInputs): RideTimeCalcResult {
  const {
    appointment_time,
    appointment_end_time,
    duration_seconds,
    pickupBufferMinutes = DEFAULT_PICKUP_BUFFER_MINUTES,
    returnBufferMinutes = DEFAULT_RETURN_BUFFER_MINUTES,
  } = inputs

  const suggestedPickupTime = calculateOutboundPickup(
    appointment_time,
    duration_seconds,
    pickupBufferMinutes
  )

  const suggestedReturnPickupTime = calculateReturnPickup(
    appointment_end_time,
    returnBufferMinutes
  )

  return { suggestedPickupTime, suggestedReturnPickupTime }
}

/**
 * Calculate outbound pickup time.
 * appointment_time - ceil(duration_seconds / 60) - bufferMinutes
 */
function calculateOutboundPickup(
  appointmentTime: string | null,
  durationSeconds: number | null,
  bufferMinutes: number
): string | null {
  if (appointmentTime === null || durationSeconds === null) {
    return null
  }

  const durationMinutes = Math.ceil(durationSeconds / 60)
  const totalMinutesToSubtract = durationMinutes + bufferMinutes

  return subtractMinutesFromTime(appointmentTime, totalMinutesToSubtract)
}

/**
 * Calculate return pickup time.
 * appointment_end_time + bufferMinutes
 */
function calculateReturnPickup(
  appointmentEndTime: string | null,
  bufferMinutes: number
): string | null {
  if (appointmentEndTime === null) {
    return null
  }

  return addMinutesToTime(appointmentEndTime, bufferMinutes)
}

// ---------------------------------------------------------------------------
// Time Conflict Detection
// ---------------------------------------------------------------------------

/** Default ride duration fallback in seconds (60 minutes). */
const DEFAULT_RIDE_DURATION_SECONDS = 3600

/** Minimal ride input for conflict detection. */
export interface ConflictRideInput {
  id: string
  pickup_time: string
  duration_seconds: number | null
  driver_id: string | null
  status: string
}

/** A pair of rides that overlap in time for the same driver. */
export interface ConflictInfo {
  rideIdA: string
  rideIdB: string
  driverId: string
  /** Overlap window start in "HH:MM" format */
  overlapStart: string
  /** Overlap window end in "HH:MM" format */
  overlapEnd: string
}

/**
 * Parse a time string ("HH:MM" or "HH:MM:SS") to minutes since midnight.
 */
function timeToMinutes(time: string): number {
  const parts = time.split(":")
  const hours = parseInt(parts[0] ?? "0", 10)
  const minutes = parseInt(parts[1] ?? "0", 10)
  return hours * 60 + minutes
}

/**
 * Format minutes since midnight to "HH:MM".
 */
function minutesToTime(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(totalMinutes, 1439))
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/**
 * Detect time conflicts among rides assigned to the same driver.
 *
 * Algorithm: O(n log n) — group by driver, sort by pickup_time, then
 * check consecutive pairs for overlap.
 *
 * A ride's time window is [pickup_time, pickup_time + duration_seconds].
 * If duration_seconds is null, DEFAULT_RIDE_DURATION_SECONDS (60 min) is used.
 *
 * Rides with status "cancelled" or "no_show" are excluded.
 * Rides without a driver_id are excluded.
 */
export function detectTimeConflicts(rides: ConflictRideInput[]): ConflictInfo[] {
  // Filter to assigned, non-terminal rides
  const activeRides = rides.filter(
    (r) =>
      r.driver_id !== null &&
      r.status !== "cancelled" &&
      r.status !== "no_show"
  )

  // Group by driver
  const byDriver = new Map<string, ConflictRideInput[]>()
  for (const ride of activeRides) {
    const driverId = ride.driver_id!
    const group = byDriver.get(driverId) ?? []
    group.push(ride)
    byDriver.set(driverId, group)
  }

  const conflicts: ConflictInfo[] = []

  for (const [driverId, driverRides] of byDriver) {
    if (driverRides.length < 2) continue

    // Sort by pickup_time (string comparison works for HH:MM format)
    driverRides.sort((a, b) => a.pickup_time.localeCompare(b.pickup_time))

    for (let i = 0; i < driverRides.length - 1; i++) {
      const current = driverRides[i]!
      const next = driverRides[i + 1]!

      const currentStart = timeToMinutes(current.pickup_time)
      const currentDuration = current.duration_seconds ?? DEFAULT_RIDE_DURATION_SECONDS
      const currentEnd = currentStart + Math.ceil(currentDuration / 60)

      const nextStart = timeToMinutes(next.pickup_time)
      const nextDuration = next.duration_seconds ?? DEFAULT_RIDE_DURATION_SECONDS
      const nextEnd = nextStart + Math.ceil(nextDuration / 60)

      if (currentEnd > nextStart) {
        const overlapStart = Math.max(currentStart, nextStart)
        const overlapEnd = Math.min(currentEnd, nextEnd)
        conflicts.push({
          rideIdA: current.id,
          rideIdB: next.id,
          driverId,
          overlapStart: minutesToTime(overlapStart),
          overlapEnd: minutesToTime(overlapEnd),
        })
      }
    }
  }

  return conflicts
}
