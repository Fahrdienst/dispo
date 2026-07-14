import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Mocks -- vi.hoisted() so variables are available in vi.mock() factories
// ---------------------------------------------------------------------------

const { mockGetZoneForPostalCode, mockGetRoute } = vi.hoisted(() => ({
  mockGetZoneForPostalCode: vi.fn(),
  mockGetRoute: vi.fn(),
}))

vi.mock("server-only", () => ({}))

vi.mock("../zone-lookup", () => ({
  getZoneForPostalCode: mockGetZoneForPostalCode,
}))

vi.mock("@/lib/maps/directions", () => ({
  getRoute: mockGetRoute,
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { calculateRidePrice } from "../calculate-price"
import type { PriceCalculationOutcome } from "../calculate-price"
import type { PriceCalculation } from "../types"

// ---------------------------------------------------------------------------
// Test data / helpers
// ---------------------------------------------------------------------------

const patientCoords = { lat: 47.397, lng: 8.651 }
const destinationCoords = { lat: 47.378, lng: 8.540 }

const mockRouteResult = {
  distance_meters: 12500,
  duration_seconds: 1080,
  polyline: "abc123",
}

/** Narrows a successful outcome to PriceCalculation, failing the test otherwise. */
function asPrice(outcome: PriceCalculationOutcome): PriceCalculation {
  if ("error" in outcome) {
    throw new Error(`expected a price, got error "${outcome.error}"`)
  }
  return outcome
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("calculateRidePrice (Duebendorf tariff)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("calculates Gemeinde single trip correctly (CHF 8)", async () => {
    mockGetZoneForPostalCode.mockResolvedValue(null)
    mockGetRoute.mockResolvedValue(mockRouteResult)

    const result = asPrice(
      await calculateRidePrice({
        patientPostalCode: "8600",
        destinationPostalCode: "8600",
        patientCoords,
        destinationCoords,
        direction: "outbound",
        durationCategory: "under_2h",
        destinationName: "Arztpraxis Duebendorf",
        hasEscort: false,
        isTagesheimImwilOverride: false,
      })
    )

    expect(result.calculated_price).toBe(8.0)
    expect(result.tariff_zone).toBe("gemeinde")
  })

  it("calculates Gemeinde round trip under 2h (CHF 12)", async () => {
    mockGetZoneForPostalCode.mockResolvedValue(null)
    mockGetRoute.mockResolvedValue(mockRouteResult)

    const result = asPrice(
      await calculateRidePrice({
        patientPostalCode: "8600",
        destinationPostalCode: "8600",
        patientCoords,
        destinationCoords,
        direction: "both",
        durationCategory: "under_2h",
        destinationName: "Praxis Duebendorf",
        hasEscort: false,
        isTagesheimImwilOverride: false,
      })
    )

    expect(result.calculated_price).toBe(12.0)
  })

  it("calculates Gemeinde round trip over 2h (CHF 16)", async () => {
    mockGetZoneForPostalCode.mockResolvedValue(null)
    mockGetRoute.mockResolvedValue(mockRouteResult)

    const result = asPrice(
      await calculateRidePrice({
        patientPostalCode: "8600",
        destinationPostalCode: "8600",
        patientCoords,
        destinationCoords,
        direction: "both",
        durationCategory: "over_2h",
        destinationName: "Praxis Duebendorf",
        hasEscort: false,
        isTagesheimImwilOverride: false,
      })
    )

    expect(result.calculated_price).toBe(16.0)
  })

  it("calculates Tagesheim Imwil round trip (CHF 14)", async () => {
    mockGetZoneForPostalCode.mockResolvedValue(null)
    mockGetRoute.mockResolvedValue(mockRouteResult)

    const result = asPrice(
      await calculateRidePrice({
        patientPostalCode: "8600",
        destinationPostalCode: "8600",
        patientCoords,
        destinationCoords,
        direction: "both",
        durationCategory: "under_2h",
        destinationName: "Tagesheim Imwil",
        hasEscort: false,
        isTagesheimImwilOverride: false,
      })
    )

    expect(result.calculated_price).toBe(14.0)
  })

  it("calculates Zone 1 under 2h (CHF 16)", async () => {
    // 8050 = Zurich rechts -> Zone 1
    mockGetZoneForPostalCode.mockResolvedValue(null)
    mockGetRoute.mockResolvedValue(mockRouteResult)

    const result = asPrice(
      await calculateRidePrice({
        patientPostalCode: "8600",
        destinationPostalCode: "8050",
        patientCoords,
        destinationCoords,
        direction: "both",
        durationCategory: "under_2h",
        destinationName: "Spital Zurich",
        hasEscort: false,
        isTagesheimImwilOverride: false,
      })
    )

    expect(result.calculated_price).toBe(16.0)
    expect(result.tariff_zone).toBe("zone_1")
  })

  it("calculates Zone 3 (Zurich links) under 2h (CHF 35)", async () => {
    // 8047 = Zurich links -> Zone 3
    mockGetZoneForPostalCode.mockResolvedValue(null)
    mockGetRoute.mockResolvedValue(mockRouteResult)

    const result = asPrice(
      await calculateRidePrice({
        patientPostalCode: "8600",
        destinationPostalCode: "8047",
        patientCoords,
        destinationCoords,
        direction: "both",
        durationCategory: "under_2h",
        destinationName: "Klinik Zurich West",
        hasEscort: false,
        isTagesheimImwilOverride: false,
      })
    )

    expect(result.calculated_price).toBe(35.0)
    expect(result.tariff_zone).toBe("zone_3")
  })

  it("calculates ausserkantonal per-km price", async () => {
    mockGetZoneForPostalCode.mockResolvedValue(null)
    // 12500m = 12.5km, outbound -> price = 12.5 * 1.00 = CHF 12.50
    mockGetRoute.mockResolvedValue(mockRouteResult)

    const result = asPrice(
      await calculateRidePrice({
        patientPostalCode: "8600",
        destinationPostalCode: "5000",
        patientCoords,
        destinationCoords,
        direction: "outbound",
        durationCategory: "under_2h",
        destinationName: "Spital Aarau",
        hasEscort: false,
        isTagesheimImwilOverride: false,
      })
    )

    expect(result.calculated_price).toBe(12.5)
    expect(result.tariff_zone).toBe("ausserkantonal")
  })

  it("adds escort surcharge for ausserkantonal (+ CHF 20)", async () => {
    mockGetZoneForPostalCode.mockResolvedValue(null)
    mockGetRoute.mockResolvedValue(mockRouteResult)

    const result = asPrice(
      await calculateRidePrice({
        patientPostalCode: "8600",
        destinationPostalCode: "5000",
        patientCoords,
        destinationCoords,
        direction: "outbound",
        durationCategory: "under_2h",
        destinationName: "Spital Aarau",
        hasEscort: true,
        isTagesheimImwilOverride: false,
      })
    )

    // 12.5km * CHF 1.00 + CHF 20 escort = CHF 32.50
    expect(result.calculated_price).toBe(32.5)
    expect(result.surcharge_amount).toBe(20)
  })

  it("returns a route_unavailable error for ausserkantonal when route fails", async () => {
    mockGetZoneForPostalCode.mockResolvedValue(null)
    mockGetRoute.mockRejectedValue(new Error("Directions API failed"))

    const result = await calculateRidePrice({
      patientPostalCode: "8600",
      destinationPostalCode: "5000",
      patientCoords,
      destinationCoords,
      direction: "outbound",
      durationCategory: "under_2h",
      destinationName: "Spital Aarau",
      hasEscort: false,
      isTagesheimImwilOverride: false,
    })

    expect(result).toEqual({ error: "route_unavailable" })
  })

  it("still calculates zone tariff when route fails (non-ausserkantonal)", async () => {
    mockGetZoneForPostalCode.mockResolvedValue(null)
    mockGetRoute.mockRejectedValue(new Error("Directions API failed"))

    const result = asPrice(
      await calculateRidePrice({
        patientPostalCode: "8600",
        destinationPostalCode: "8600",
        patientCoords,
        destinationCoords,
        direction: "outbound",
        durationCategory: "under_2h",
        destinationName: "Praxis",
        hasEscort: false,
        isTagesheimImwilOverride: false,
      })
    )

    // Should still work -- Gemeinde tariff doesn't need distance
    expect(result.calculated_price).toBe(8.0)
    expect(result.distance_meters).toBe(0)
  })
})
