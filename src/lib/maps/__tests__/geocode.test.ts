import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Mocks -- vi.hoisted() so variables are available in vi.mock() factories
// ---------------------------------------------------------------------------

const { mockFetch, mockFrom, mockUpdate, mockEq } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockFrom: vi.fn(),
  mockUpdate: vi.fn(),
  mockEq: vi.fn(),
}))

vi.mock("server-only", () => ({}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: mockFrom.mockReturnValue({
      update: mockUpdate.mockReturnValue({
        eq: mockEq,
      }),
    }),
  }),
}))

vi.stubGlobal("fetch", mockFetch)

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { geocodeAddress, geocodeAndUpdateRecord } from "../geocode"
import { GeocodeFailedError, MapsApiError } from "../errors"

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const testAddress = {
  street: "Bahnhofstrasse",
  house_number: "1",
  postal_code: "8001",
  city: "Zuerich",
}

const successApiResponse = {
  status: "OK",
  results: [
    {
      geometry: { location: { lat: 47.3667, lng: 8.5500 } },
      place_id: "ChIJGaK-SZcLkEcR_1EfA3BPCzU",
      formatted_address: "Bahnhofstrasse 1, 8001 Zuerich, Switzerland",
    },
  ],
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetchResponse(body: unknown, ok = true, status = 200): void {
  mockFetch.mockResolvedValue({
    ok,
    status,
    statusText: ok ? "OK" : "Internal Server Error",
    json: () => Promise.resolve(body),
  })
}

// ---------------------------------------------------------------------------
// Tests: geocodeAddress
// ---------------------------------------------------------------------------

describe("geocodeAddress", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GOOGLE_MAPS_API_KEY = "test-api-key"
  })

  it("returns geocode result on success", async () => {
    mockFetchResponse(successApiResponse)

    const result = await geocodeAddress(testAddress)

    expect(result).toEqual({
      lat: 47.3667,
      lng: 8.5500,
      place_id: "ChIJGaK-SZcLkEcR_1EfA3BPCzU",
      formatted_address: "Bahnhofstrasse 1, 8001 Zuerich, Switzerland",
    })
  })

  it("builds correct address string with Swiss country suffix", async () => {
    mockFetchResponse(successApiResponse)

    await geocodeAddress(testAddress)

    const fetchUrl = mockFetch.mock.calls[0]?.[0] as string
    expect(fetchUrl).toContain("Bahnhofstrasse+1%2C+8001+Zuerich%2C+Schweiz")
    expect(fetchUrl).toContain("components=country%3ACH")
  })

  it("returns null for ZERO_RESULTS", async () => {
    mockFetchResponse({ status: "ZERO_RESULTS", results: [] })

    const result = await geocodeAddress(testAddress)

    expect(result).toBeNull()
  })

  it("throws GeocodeFailedError when OK but no results", async () => {
    mockFetchResponse({ status: "OK", results: [] })

    await expect(geocodeAddress(testAddress)).rejects.toThrow(
      GeocodeFailedError
    )
  })

  it("throws MapsApiError on REQUEST_DENIED", async () => {
    mockFetchResponse({
      status: "REQUEST_DENIED",
      error_message: "API key invalid",
      results: [],
    })

    await expect(geocodeAddress(testAddress)).rejects.toThrow(MapsApiError)
  })

  it("throws MapsApiError on HTTP error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: () => Promise.resolve({}),
    })

    await expect(geocodeAddress(testAddress)).rejects.toThrow(MapsApiError)
  })

  it("throws MapsApiError when GOOGLE_MAPS_API_KEY is not set", async () => {
    delete process.env.GOOGLE_MAPS_API_KEY

    await expect(geocodeAddress(testAddress)).rejects.toThrow(MapsApiError)
  })
})

// ---------------------------------------------------------------------------
// Tests: geocodeAndUpdateRecord
// ---------------------------------------------------------------------------

describe("geocodeAndUpdateRecord", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GOOGLE_MAPS_API_KEY = "test-api-key"
  })

  it("updates record with geocode result on success", async () => {
    mockFetchResponse(successApiResponse)
    mockEq.mockResolvedValue({ error: null })

    await geocodeAndUpdateRecord("patients", "patient-1", testAddress)

    expect(mockFrom).toHaveBeenCalledWith("patients")
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        lat: 47.3667,
        lng: 8.5500,
        place_id: "ChIJGaK-SZcLkEcR_1EfA3BPCzU",
        formatted_address: "Bahnhofstrasse 1, 8001 Zuerich, Switzerland",
        geocode_status: "success",
        geocode_updated_at: expect.any(String),
      })
    )
    expect(mockEq).toHaveBeenCalledWith("id", "patient-1")
  })

  it("sets geocode_status to failed on ZERO_RESULTS", async () => {
    mockFetchResponse({ status: "ZERO_RESULTS", results: [] })
    mockEq.mockResolvedValue({ error: null })

    await geocodeAndUpdateRecord("destinations", "dest-1", testAddress)

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        geocode_status: "failed",
        geocode_updated_at: expect.any(String),
      })
    )
  })

  it("sets geocode_status to failed on API error", async () => {
    mockFetchResponse({
      status: "REQUEST_DENIED",
      error_message: "API key invalid",
      results: [],
    })
    mockEq.mockResolvedValue({ error: null })

    await geocodeAndUpdateRecord("patients", "patient-2", testAddress)

    // After the API error, the catch block should update with status 'failed'
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        geocode_status: "failed",
        geocode_updated_at: expect.any(String),
      })
    )
  })

  it("does not throw when DB update fails", async () => {
    mockFetchResponse(successApiResponse)
    mockEq.mockResolvedValue({
      error: { message: "DB error", code: "500" },
    })

    // Should not throw -- fire-and-forget pattern
    await expect(
      geocodeAndUpdateRecord("patients", "patient-1", testAddress)
    ).resolves.toBeUndefined()
  })

  it("does not throw when geocoding fails and DB update also fails", async () => {
    mockFetchResponse({
      status: "REQUEST_DENIED",
      error_message: "API key invalid",
      results: [],
    })
    mockEq.mockRejectedValue(new Error("DB connection lost"))

    // Should not throw -- double-fault scenario
    await expect(
      geocodeAndUpdateRecord("patients", "patient-1", testAddress)
    ).resolves.toBeUndefined()
  })
})
