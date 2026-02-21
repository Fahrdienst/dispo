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
