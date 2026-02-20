import "server-only"

import { getFareRule } from "./zone-lookup"
import { getRoute } from "@/lib/maps/directions"
import type { GeoPoint } from "@/lib/maps/types"
import type { PriceCalculation } from "./types"

/**
 * Calculate the price for a ride based on zone-based fare rules and route distance.
 *
 * Steps:
 * 1. Look up fare rule for the from/to postal code combination on the given date
 * 2. Calculate driving route distance via Google Directions API
 * 3. Apply formula: base_price + (distance_km * price_per_km)
 *
 * Returns null if:
 * - No fare rule exists for the zone combination
 * - The Directions API fails (coordinates missing or invalid)
 */
export async function calculateRidePrice(
  patientPostalCode: string,
  destinationPostalCode: string,
  patientCoords: GeoPoint,
  destinationCoords: GeoPoint,
  rideDate: string
): Promise<PriceCalculation | null> {
  // 1. Zone-Lookup via PLZ
  const fareRule = await getFareRule(
    patientPostalCode,
    destinationPostalCode,
    rideDate
  )
  if (!fareRule) return null

  // 2. Route via Directions API
  let route
  try {
    route = await getRoute(patientCoords, destinationCoords)
  } catch (err: unknown) {
    console.error("Route calculation failed for price:", err)
    return null
  }

  // 3. Calculate price
  const distanceKm = route.distance_meters / 1000
  const rawPrice =
    Number(fareRule.base_price) + distanceKm * Number(fareRule.price_per_km)
  const calculatedPrice = Math.round(rawPrice * 100) / 100

  return {
    calculated_price: calculatedPrice,
    fare_rule_id: fareRule.id,
    distance_meters: route.distance_meters,
    duration_seconds: route.duration_seconds,
  }
}
