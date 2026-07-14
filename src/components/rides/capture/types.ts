/**
 * Shared types for the "Fahrt erfassen" two-column capture page (Issue #131).
 *
 * These are the contract between the core {@link RideCaptureForm} and its slot
 * components (#132–#137). The core owns all state; slots receive the relevant
 * slice plus setters via their own `*Props` interfaces (co-located in each slot
 * file). Keeping the shared shapes here avoids a circular import between the
 * core and the slots.
 */

import type { Enums } from "@/lib/types/database"
import type { DurationCategory } from "@/lib/billing/duebendorf-tariff"

/**
 * Result of a route calculation (mirrors the payload of
 * `calculateRouteForRide` in `@/actions/rides`). The core fetches it once and
 * hands it down to the map (#132) and price (#133) panels, and uses
 * `duration_seconds` to seed the live pickup-time suggestion.
 */
export interface RouteInfo {
  distance_meters: number
  duration_seconds: number
  origin_lat: number
  origin_lng: number
  dest_lat: number
  dest_lng: number
  polyline: string
}

/** Minimal patient shape needed by the capture page (list + cost bearer). */
export interface CapturePatient {
  id: string
  first_name: string
  last_name: string
  cost_bearer: Enums<"cost_bearer_type"> | null
}

/** Minimal destination shape needed by the capture page. */
export interface CaptureDestination {
  id: string
  display_name: string
  postal_code: string | null
}

/**
 * The trip type toggle. `round_trip` (Hin + Rück) is the default and creates a
 * linked return ride from the appointment duration (Design #2/#5); `one_way`
 * (Einzelfahrt) captures only the outbound leg.
 */
export type RideType = "round_trip" | "one_way"

/** Re-exported for slot components: tariff stay-duration bucket. */
export type { DurationCategory }
