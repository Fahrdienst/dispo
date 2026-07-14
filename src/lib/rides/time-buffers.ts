/**
 * Ride time-buffer loader (Issue #129).
 *
 * Server-side glue that reads the organization-wide time-buffer defaults
 * (Issue #128) from `organization_settings` and hands them to the pure
 * `calculateRideTimes` function in `./time-calc`. Keeping the I/O here keeps
 * the calculation itself side-effect free and unit-testable (same split as
 * `resolveAvailability` vs. its loaders).
 *
 * The buffers are org-wide defaults, not per-ride values: they only seed the
 * overridable pickup-time suggestion.
 */

import { createClient } from "@/lib/supabase/server"
import {
  DEFAULT_PICKUP_BUFFER_MINUTES,
  DEFAULT_BOARDING_MINUTES,
  DEFAULT_RETURN_BUFFER_MINUTES,
} from "@/lib/validations/rides"

/** Client type accepted by the loader (awaited server Supabase client). */
type ServerClient = Awaited<ReturnType<typeof createClient>>

/** Resolved org-wide time buffers used to seed pickup-time suggestions. */
export interface RideTimeBuffers {
  /** Minutes subtracted before the drive duration (driver approach lead time). */
  pickupBufferMinutes: number
  /** Minutes reserved for boarding/alighting at the patient. */
  boardingMinutes: number
  /** Minutes added after appointment end for the return pickup. */
  returnBufferMinutes: number
}

/**
 * Fallback buffers matching the legacy hardcoded constants. Used whenever the
 * organization settings cannot be loaded so ride creation never breaks.
 */
export const DEFAULT_RIDE_TIME_BUFFERS: RideTimeBuffers = {
  pickupBufferMinutes: DEFAULT_PICKUP_BUFFER_MINUTES,
  boardingMinutes: DEFAULT_BOARDING_MINUTES,
  returnBufferMinutes: DEFAULT_RETURN_BUFFER_MINUTES,
}

/**
 * Load the organization-wide time-buffer defaults.
 *
 * Reads the singleton `organization_settings` row. On any error (missing row,
 * RLS, etc.) it falls back to {@link DEFAULT_RIDE_TIME_BUFFERS} so callers can
 * always rely on a usable result. Pass an existing server client to avoid a
 * redundant client creation inside a Server Action.
 */
export async function loadRideTimeBuffers(
  client?: ServerClient
): Promise<RideTimeBuffers> {
  const supabase = client ?? (await createClient())

  const { data, error } = await supabase
    .from("organization_settings")
    .select(
      "default_pickup_buffer_minutes, default_boarding_minutes, default_return_buffer_minutes"
    )
    .limit(1)
    .single()

  if (error || !data) {
    return DEFAULT_RIDE_TIME_BUFFERS
  }

  return {
    pickupBufferMinutes:
      data.default_pickup_buffer_minutes ?? DEFAULT_PICKUP_BUFFER_MINUTES,
    boardingMinutes:
      data.default_boarding_minutes ?? DEFAULT_BOARDING_MINUTES,
    returnBufferMinutes:
      data.default_return_buffer_minutes ?? DEFAULT_RETURN_BUFFER_MINUTES,
  }
}
