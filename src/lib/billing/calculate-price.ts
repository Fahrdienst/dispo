import "server-only"

import { getZoneForPostalCode } from "./zone-lookup"
import { determineTariffZone, isTagesheimImwil } from "./zone-determination"
import { calculateDuebendorfTariff } from "./duebendorf-tariff"
import { getRoute } from "@/lib/maps/directions"
import type { GeoPoint } from "@/lib/maps/types"
import type { PriceCalculation } from "./types"
import type { DurationCategory, TariffZone } from "./duebendorf-tariff"

/**
 * Input parameters for ride price calculation.
 */
interface CalculateRidePriceInput {
  patientPostalCode: string
  destinationPostalCode: string
  patientCoords: GeoPoint
  destinationCoords: GeoPoint
  direction: "outbound" | "return" | "both"
  durationCategory: DurationCategory
  destinationName: string
  hasEscort: boolean
  isTagesheimImwilOverride: boolean
}

/**
 * Calculate the price for a ride using the Duebendorf tariff model.
 *
 * Steps:
 * 1. Determine tariff zone from destination postal code (with DB zone lookup fallback)
 * 2. Detect Tagesheim Imwil special case
 * 3. Calculate route distance via Google Directions API (needed for ausserkantonal)
 * 4. Apply Duebendorf tariff calculation
 *
 * Returns null if the route calculation fails (e.g., missing coordinates).
 */
export async function calculateRidePrice(
  input: CalculateRidePriceInput
): Promise<PriceCalculation | null> {
  const {
    patientPostalCode,
    destinationPostalCode,
    patientCoords,
    destinationCoords,
    direction,
    durationCategory,
    destinationName,
    hasEscort,
    isTagesheimImwilOverride,
  } = input

  // 1. Zone lookup: first check DB, then apply Duebendorf rules
  const dbZone = await getZoneForPostalCode(destinationPostalCode)
  const tariffZone: TariffZone = determineTariffZone(
    destinationPostalCode,
    dbZone?.name ?? null
  )

  // 2. Tagesheim Imwil detection
  const isImwil = isTagesheimImwilOverride || isTagesheimImwil(destinationName)

  // 3. Route calculation (needed for distance display and ausserkantonal pricing)
  let routeDistance = 0
  let routeDuration = 0
  let routePolyline = ""
  try {
    const route = await getRoute(patientCoords, destinationCoords)
    routeDistance = route.distance_meters
    routeDuration = route.duration_seconds
    routePolyline = route.polyline
  } catch (err: unknown) {
    console.error("Route calculation failed for price:", err)
    // For ausserkantonal, we need the distance — return null
    if (tariffZone === "ausserkantonal") {
      return null
    }
    // For other zones, distance is informational; continue with 0
  }

  // 4. Apply tariff
  const distanceKm = routeDistance / 1000
  const tariffResult = calculateDuebendorfTariff({
    zone: tariffZone,
    direction,
    durationCategory,
    isTagesheimImwil: isImwil,
    hasEscort,
    distanceKm,
  })

  return {
    calculated_price: tariffResult.price,
    fare_rule_id: null, // Legacy field — not used with new tariff
    distance_meters: routeDistance,
    duration_seconds: routeDuration,
    tariff_zone: tariffResult.zone,
    breakdown: tariffResult.breakdown,
    polyline: routePolyline,
    surcharge_amount: hasEscort && tariffZone === "ausserkantonal" ? 20 : 0,
  }
}

/**
 * Legacy-compatible wrapper for existing call sites that use the old signature.
 * Delegates to the new calculateRidePrice with sensible defaults.
 *
 * @deprecated Use calculateRidePrice(input) directly for full tariff support.
 */
export async function calculateRidePriceLegacy(
  patientPostalCode: string,
  destinationPostalCode: string,
  patientCoords: GeoPoint,
  destinationCoords: GeoPoint,
  _rideDate: string
): Promise<PriceCalculation | null> {
  return calculateRidePrice({
    patientPostalCode,
    destinationPostalCode,
    patientCoords,
    destinationCoords,
    direction: "outbound",
    durationCategory: "under_2h",
    destinationName: "",
    hasEscort: false,
    isTagesheimImwilOverride: false,
  })
}
