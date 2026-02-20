import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Mocks -- vi.hoisted() so variables are available in vi.mock() factories
// ---------------------------------------------------------------------------

const { mockGetFareRule, mockGetRoute } = vi.hoisted(() => ({
  mockGetFareRule: vi.fn(),
  mockGetRoute: vi.fn(),
}))

vi.mock("server-only", () => ({}))

vi.mock("../zone-lookup", () => ({
  getFareRule: mockGetFareRule,
}))

vi.mock("@/lib/maps/directions", () => ({
  getRoute: mockGetRoute,
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { calculateRidePrice } from "../calculate-price"

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const patientCoords = { lat: 47.397, lng: 8.651 }
const destinationCoords = { lat: 47.378, lng: 8.540 }

const mockFareRule = {
  id: "rule-1",
  fare_version_id: "fv-1",
  from_zone_id: "zone-1",
  to_zone_id: "zone-2",
  base_price: 25.0,
  price_per_km: 2.5,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  fare_versions: {
    id: "fv-1",
    name: "Tarif 2026",
    valid_from: "2026-01-01",
    valid_to: null,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
}

const mockRouteResult = {
  distance_meters: 12500,
  duration_seconds: 1080,
  polyline: "abc123",
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("calculateRidePrice", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("calculates price correctly with base_price + distance * price_per_km", async () => {
    mockGetFareRule.mockResolvedValue(mockFareRule)
    mockGetRoute.mockResolvedValue(mockRouteResult)

    const result = await calculateRidePrice(
      "8600",
      "8001",
      patientCoords,
      destinationCoords,
      "2026-03-15"
    )

    expect(result).not.toBeNull()
    // base_price: 25 + (12.5 km * 2.5 CHF/km) = 25 + 31.25 = 56.25
    expect(result!.calculated_price).toBe(56.25)
    expect(result!.fare_rule_id).toBe("rule-1")
    expect(result!.distance_meters).toBe(12500)
    expect(result!.duration_seconds).toBe(1080)
  })

  it("rounds price to 2 decimal places", async () => {
    const ruleWithOddPrice = {
      ...mockFareRule,
      base_price: 10.0,
      price_per_km: 3.33,
    }
    mockGetFareRule.mockResolvedValue(ruleWithOddPrice)
    // 7777m = 7.777km -> 10 + (7.777 * 3.33) = 10 + 25.89741 = 35.89741 -> 35.9
    mockGetRoute.mockResolvedValue({
      distance_meters: 7777,
      duration_seconds: 600,
    })

    const result = await calculateRidePrice(
      "8600",
      "8001",
      patientCoords,
      destinationCoords,
      "2026-03-15"
    )

    expect(result).not.toBeNull()
    expect(result!.calculated_price).toBe(35.9)
  })

  it("returns null when no fare rule exists for the zone combination", async () => {
    mockGetFareRule.mockResolvedValue(null)

    const result = await calculateRidePrice(
      "9999",
      "8001",
      patientCoords,
      destinationCoords,
      "2026-03-15"
    )

    expect(result).toBeNull()
    // getRoute should NOT be called when there's no fare rule
    expect(mockGetRoute).not.toHaveBeenCalled()
  })

  it("returns null when route calculation fails", async () => {
    mockGetFareRule.mockResolvedValue(mockFareRule)
    mockGetRoute.mockRejectedValue(new Error("Directions API failed"))

    const result = await calculateRidePrice(
      "8600",
      "8001",
      patientCoords,
      destinationCoords,
      "2026-03-15"
    )

    expect(result).toBeNull()
  })

  it("handles zero distance correctly", async () => {
    mockGetFareRule.mockResolvedValue(mockFareRule)
    mockGetRoute.mockResolvedValue({
      distance_meters: 0,
      duration_seconds: 0,
    })

    const result = await calculateRidePrice(
      "8600",
      "8600",
      patientCoords,
      patientCoords,
      "2026-03-15"
    )

    expect(result).not.toBeNull()
    // base_price only: 25 + (0 * 2.5) = 25
    expect(result!.calculated_price).toBe(25.0)
    expect(result!.distance_meters).toBe(0)
  })

  it("passes correct postal codes and date to getFareRule", async () => {
    mockGetFareRule.mockResolvedValue(null)

    await calculateRidePrice(
      "8600",
      "8001",
      patientCoords,
      destinationCoords,
      "2026-06-01"
    )

    expect(mockGetFareRule).toHaveBeenCalledWith("8600", "8001", "2026-06-01")
  })

  it("passes correct coordinates to getRoute", async () => {
    mockGetFareRule.mockResolvedValue(mockFareRule)
    mockGetRoute.mockResolvedValue(mockRouteResult)

    await calculateRidePrice(
      "8600",
      "8001",
      patientCoords,
      destinationCoords,
      "2026-03-15"
    )

    expect(mockGetRoute).toHaveBeenCalledWith(patientCoords, destinationCoords)
  })
})
