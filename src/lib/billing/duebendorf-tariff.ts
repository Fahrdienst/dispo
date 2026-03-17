/**
 * Duebendorf tariff model — fixed-price tariffs based on zone, direction, and duration.
 *
 * Tariff structure:
 * - Gemeinde Duebendorf: flat prices (outbound CHF 8, round trip under 2h CHF 12, etc.)
 * - Kanton Zurich zones 1-3: price depends on duration category (under/over 2h)
 * - Ausserkantonal: CHF 1.00 per km (round trip distance via Google Maps)
 * - Escort surcharge: +CHF 20 (ausserkantonal only)
 * - Special case: Tagesheim Imwil round trip = CHF 14
 */

// =============================================================================
// Tariff Constants
// =============================================================================

/** Gemeinde Duebendorf flat-rate tariffs */
const GEMEINDE_TARIFFS = {
  single: 8.0, // Einfache Fahrt (outbound or return)
  round_trip_under_2h: 12.0, // Hin+Rueck bis 2h
  round_trip_over_2h: 16.0, // Hin+Rueck ab 2h
  tagesheim_imwil: 14.0, // Tagesheim Imwil (H+R)
} as const

/** Zone-based tariffs for Kanton Zurich */
const ZONE_TARIFFS: Record<"zone_1" | "zone_2" | "zone_3", Record<DurationCategory, number>> = {
  zone_1: { under_2h: 16.0, over_2h: 24.0 },
  zone_2: { under_2h: 25.0, over_2h: 45.0 },
  zone_3: { under_2h: 35.0, over_2h: 55.0 },
} as const

/** Ausserkantonal per-km rate and escort surcharge */
const AUSSERKANTONAL = {
  per_km: 1.0,
  escort_surcharge: 20.0,
} as const

// =============================================================================
// Types
// =============================================================================

/** Tariff zone classification */
export type TariffZone = "gemeinde" | "zone_1" | "zone_2" | "zone_3" | "ausserkantonal"

/** Duration category determines pricing tier for zone tariffs */
export type DurationCategory = "under_2h" | "over_2h"

/** Input for tariff calculation */
export interface TariffInput {
  zone: TariffZone
  direction: "outbound" | "return" | "both"
  durationCategory: DurationCategory
  isTagesheimImwil: boolean
  hasEscort: boolean
  /** Round-trip distance in km — required for ausserkantonal */
  distanceKm?: number
}

/** Single line item in the price breakdown */
export interface TariffBreakdownItem {
  label: string
  amount: number
}

/** Result of a tariff calculation */
export interface TariffResult {
  /** Total price in CHF */
  price: number
  /** Human-readable breakdown of all price components */
  breakdown: TariffBreakdownItem[]
  /** Resolved tariff zone */
  zone: TariffZone
  /** Human-readable tariff type for display */
  tariffType: string
}

// =============================================================================
// Zone Labels
// =============================================================================

/** German display labels for tariff zones */
export const TARIFF_ZONE_LABELS: Record<TariffZone, string> = {
  gemeinde: "Gemeinde Duebendorf",
  zone_1: "Zone 1 (Nachbargemeinden)",
  zone_2: "Zone 2 (Mittlerer Ring)",
  zone_3: "Zone 3 (Bis Kantonsgrenze)",
  ausserkantonal: "Ausserkantonal",
}

/** German display labels for duration categories */
export const DURATION_CATEGORY_LABELS: Record<DurationCategory, string> = {
  under_2h: "Bis 1 Std.",
  over_2h: "Ab 2 Std.",
}

// =============================================================================
// Calculation
// =============================================================================

/**
 * Calculate the Duebendorf tariff for a ride.
 *
 * Pure function — no side effects, no database access.
 * All inputs must be resolved before calling.
 */
export function calculateDuebendorfTariff(input: TariffInput): TariffResult {
  const { zone, direction, durationCategory, isTagesheimImwil, hasEscort, distanceKm } = input
  const breakdown: TariffBreakdownItem[] = []
  let basePrice = 0
  let tariffType = ""

  // --- Gemeinde Duebendorf ---
  if (zone === "gemeinde") {
    if (isTagesheimImwil && direction === "both") {
      basePrice = GEMEINDE_TARIFFS.tagesheim_imwil
      tariffType = "Tagesheim Imwil (H+R)"
      breakdown.push({ label: "Tagesheim Imwil (Hin+Rueck)", amount: basePrice })
    } else if (direction === "both") {
      basePrice =
        durationCategory === "under_2h"
          ? GEMEINDE_TARIFFS.round_trip_under_2h
          : GEMEINDE_TARIFFS.round_trip_over_2h
      tariffType = `Gemeinde (${durationCategory === "under_2h" ? "bis 2h" : "ab 2h"})`
      breakdown.push({
        label: `Hin+Rueck (${durationCategory === "under_2h" ? "bis 2 Std." : "ab 2 Std."})`,
        amount: basePrice,
      })
    } else {
      // Single trip (outbound or return)
      basePrice = GEMEINDE_TARIFFS.single
      tariffType = "Gemeinde (einfache Fahrt)"
      breakdown.push({ label: "Einfache Fahrt", amount: basePrice })
    }
  }

  // --- Kanton Zurich Zones ---
  else if (zone === "zone_1" || zone === "zone_2" || zone === "zone_3") {
    const zoneTariff = ZONE_TARIFFS[zone]
    basePrice = zoneTariff[durationCategory]
    const zoneLabel = TARIFF_ZONE_LABELS[zone]
    const durationLabel = DURATION_CATEGORY_LABELS[durationCategory]
    tariffType = `${zoneLabel} (${durationLabel})`
    breakdown.push({ label: `${zoneLabel} — ${durationLabel}`, amount: basePrice })
  }

  // --- Ausserkantonal ---
  else if (zone === "ausserkantonal") {
    const km = distanceKm ?? 0
    // Round-trip distance for price calculation
    const roundTripKm = direction === "both" ? km * 2 : km
    basePrice = Math.round(roundTripKm * AUSSERKANTONAL.per_km * 100) / 100
    tariffType = "Ausserkantonal (pro km)"
    breakdown.push({
      label: `${roundTripKm.toFixed(1)} km x CHF ${AUSSERKANTONAL.per_km.toFixed(2)}/km`,
      amount: basePrice,
    })
  }

  // --- Escort surcharge (only for ausserkantonal) ---
  let surchargeTotal = 0
  if (hasEscort && zone === "ausserkantonal") {
    surchargeTotal += AUSSERKANTONAL.escort_surcharge
    breakdown.push({ label: "Begleitung im Spital", amount: AUSSERKANTONAL.escort_surcharge })
  }

  const totalPrice = Math.round((basePrice + surchargeTotal) * 100) / 100

  return {
    price: totalPrice,
    breakdown,
    zone,
    tariffType,
  }
}
