import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Mocks -- vi.hoisted() so variables are available in vi.mock() factories
// ---------------------------------------------------------------------------

const { mockSelect, mockSingle, mockEq, mockLimit, mockLte, mockOr } =
  vi.hoisted(() => ({
    mockSelect: vi.fn(),
    mockSingle: vi.fn(),
    mockEq: vi.fn(),
    mockLimit: vi.fn(),
    mockLte: vi.fn(),
    mockOr: vi.fn(),
  }))

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "zone_postal_codes") {
        return {
          select: mockSelect.mockReturnValue({
            eq: mockEq.mockReturnValue({
              single: mockSingle,
            }),
          }),
        }
      }
      if (table === "fare_rules") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  lte: mockLte.mockReturnValue({
                    or: mockOr.mockReturnValue({
                      limit: mockLimit.mockReturnValue({
                        single: mockSingle,
                      }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        }
      }
      return {}
    }),
  }),
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { getZoneForPostalCode, getFareRule } from "../zone-lookup"

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockZone = {
  id: "zone-1",
  name: "Duebendorf",
  description: null,
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
}

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getZoneForPostalCode", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns the zone for a valid postal code", async () => {
    mockSingle.mockResolvedValue({
      data: { zone_id: "zone-1", zones: mockZone },
      error: null,
    })

    const result = await getZoneForPostalCode("8600")

    expect(result).toEqual(mockZone)
  })

  it("returns null when postal code is not assigned to a zone", async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: "Not found", code: "PGRST116" },
    })

    const result = await getZoneForPostalCode("9999")

    expect(result).toBeNull()
  })

  it("returns null on database error", async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: "Connection error", code: "500" },
    })

    const result = await getZoneForPostalCode("8600")

    expect(result).toBeNull()
  })
})

describe("getFareRule", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns null when from postal code has no zone", async () => {
    // First call (fromPostalCode) returns null
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "Not found", code: "PGRST116" },
    })

    const result = await getFareRule("9999", "8001", "2026-03-01")

    expect(result).toBeNull()
  })

  it("returns null when to postal code has no zone", async () => {
    // First call (fromPostalCode) succeeds
    mockSingle.mockResolvedValueOnce({
      data: { zone_id: "zone-1", zones: mockZone },
      error: null,
    })
    // Second call (toPostalCode) returns null
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "Not found", code: "PGRST116" },
    })

    const result = await getFareRule("8600", "9999", "2026-03-01")

    expect(result).toBeNull()
  })

  it("returns the fare rule when both zones and rule exist", async () => {
    const mockZone2 = { ...mockZone, id: "zone-2", name: "Zuerich Stadt" }

    // First call (fromPostalCode)
    mockSingle.mockResolvedValueOnce({
      data: { zone_id: "zone-1", zones: mockZone },
      error: null,
    })
    // Second call (toPostalCode)
    mockSingle.mockResolvedValueOnce({
      data: { zone_id: "zone-2", zones: mockZone2 },
      error: null,
    })
    // Third call (fare_rules query)
    mockSingle.mockResolvedValueOnce({
      data: mockFareRule,
      error: null,
    })

    const result = await getFareRule("8600", "8001", "2026-03-01")

    expect(result).toEqual(mockFareRule)
  })

  it("returns null when no fare rule exists for the zone combination", async () => {
    const mockZone2 = { ...mockZone, id: "zone-2", name: "Zuerich Stadt" }

    mockSingle.mockResolvedValueOnce({
      data: { zone_id: "zone-1", zones: mockZone },
      error: null,
    })
    mockSingle.mockResolvedValueOnce({
      data: { zone_id: "zone-2", zones: mockZone2 },
      error: null,
    })
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "Not found", code: "PGRST116" },
    })

    const result = await getFareRule("8600", "8001", "2026-03-01")

    expect(result).toBeNull()
  })
})
