/**
 * Zone determination for the Duebendorf tariff model.
 *
 * Determines the tariff zone based on the destination postal code.
 * Falls back to the existing zone_postal_codes DB table for zone 1/2/3,
 * with hardcoded rules for Gemeinde Duebendorf and Zurich Limmat-side logic.
 */

import type { TariffZone } from "./duebendorf-tariff"

// =============================================================================
// Gemeinde Duebendorf
// =============================================================================

/** Postal codes that belong to Gemeinde Duebendorf */
const GEMEINDE_DUEBENDORF_CODES = new Set(["8600"])

// =============================================================================
// Zurich Limmat Rule (Approximation)
// =============================================================================

/**
 * Zurich postal codes on the right side of the Limmat / Schwamendingen.
 * These map to Zone 1 or Zone 2 (closer to Duebendorf).
 */
const ZUERICH_RECHTS = new Set([
  "8001", "8002", "8003", "8004", "8005", "8006", "8008",
  "8032", "8037", "8038",
  "8050", "8051", "8052",
])

/**
 * Zurich postal codes on the left side of the Limmat.
 * These map to Zone 3 (further from Duebendorf).
 */
const ZUERICH_LINKS = new Set([
  "8031", "8034", "8035", "8036",
  "8041", "8042", "8043", "8044", "8045", "8046", "8047", "8048", "8049",
  "8053", "8055", "8057",
  "8063", "8064",
])

// =============================================================================
// Zone Name → TariffZone Mapping
// =============================================================================

/**
 * Maps DB zone names (from the zones table) to tariff zone identifiers.
 * This must match the zone names configured in the admin settings.
 */
const ZONE_NAME_MAP: Record<string, TariffZone> = {
  "Zone 1": "zone_1",
  "zone_1": "zone_1",
  "Zone 2": "zone_2",
  "zone_2": "zone_2",
  "Zone 3": "zone_3",
  "zone_3": "zone_3",
  // Common alternate names
  "Nachbargemeinden": "zone_1",
  "Mittlerer Ring": "zone_2",
  "Bis Kantonsgrenze": "zone_3",
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Determine the tariff zone for a destination postal code.
 *
 * Resolution order:
 * 1. PLZ 8600 → gemeinde (Duebendorf)
 * 2. Zurich PLZ (8001-8099) → check Limmat side (rechts = zone_1/zone_2, links = zone_3)
 * 3. Look up in zone_postal_codes DB table → map zone name to tariff zone
 * 4. Fallback → ausserkantonal
 *
 * @param destinationPostalCode - The postal code of the ride destination
 * @param dbZoneName - Optional: the zone name from the zone_postal_codes DB lookup
 */
export function determineTariffZone(
  destinationPostalCode: string,
  dbZoneName: string | null
): TariffZone {
  // 1. Gemeinde Duebendorf
  if (GEMEINDE_DUEBENDORF_CODES.has(destinationPostalCode)) {
    return "gemeinde"
  }

  // 2. Zurich Limmat rule
  if (ZUERICH_RECHTS.has(destinationPostalCode)) {
    // Right side of Limmat → closer to Duebendorf
    // Default to zone_1 unless DB says otherwise
    if (dbZoneName) {
      const mapped = ZONE_NAME_MAP[dbZoneName]
      if (mapped) return mapped
    }
    return "zone_1"
  }

  if (ZUERICH_LINKS.has(destinationPostalCode)) {
    // Left side of Limmat → always Zone 3
    return "zone_3"
  }

  // 3. DB zone lookup
  if (dbZoneName) {
    const mapped = ZONE_NAME_MAP[dbZoneName]
    if (mapped) return mapped
  }

  // 4. Fallback: ausserkantonal
  return "ausserkantonal"
}

/**
 * Check if a destination name contains "Imwil" (case-insensitive).
 * Used to detect the Tagesheim Imwil special case.
 */
export function isTagesheimImwil(destinationName: string): boolean {
  return /imwil/i.test(destinationName)
}
