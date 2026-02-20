import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}))

vi.mock("server-only", () => ({}))

vi.stubGlobal("fetch", mockFetch)

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { getPlaceDetails } from "../places"
import { PlaceDetailsFailedError, MapsApiError } from "../errors"

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const testPlaceId = "ChIJGaK-SZcLkEcR_1EfA3BPCzU"

const successApiResponse = {
  status: "OK",
  result: {
    name: "Universitaetsspital Zuerich",
    formatted_address: "Raemistrasse 100, 8091 Zuerich, Switzerland",
    geometry: { location: { lat: 47.3769, lng: 8.5511 } },
    formatted_phone_number: "+41 44 255 11 11",
  },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetchResponse(body: unknown, ok = true): void {
  mockFetch.mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? "OK" : "Internal Server Error",
    json: () => Promise.resolve(body),
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getPlaceDetails", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GOOGLE_MAPS_API_KEY = "test-api-key"
  })

  it("returns place details on success", async () => {
    mockFetchResponse(successApiResponse)

    const result = await getPlaceDetails(testPlaceId)

    expect(result).toEqual({
      name: "Universitaetsspital Zuerich",
      formatted_address: "Raemistrasse 100, 8091 Zuerich, Switzerland",
      lat: 47.3769,
      lng: 8.5511,
      phone: "+41 44 255 11 11",
    })
  })

  it("returns phone as undefined when not provided", async () => {
    const responseWithoutPhone = {
      status: "OK",
      result: {
        name: "Spital",
        formatted_address: "Strasse 1, 8001 Zuerich",
        geometry: { location: { lat: 47.37, lng: 8.55 } },
      },
    }
    mockFetchResponse(responseWithoutPhone)

    const result = await getPlaceDetails(testPlaceId)

    expect(result).not.toBeNull()
    expect(result!.phone).toBeUndefined()
  })

  it("passes correct fields and place_id params", async () => {
    mockFetchResponse(successApiResponse)

    await getPlaceDetails(testPlaceId)

    const fetchUrl = mockFetch.mock.calls[0]?.[0] as string
    expect(fetchUrl).toContain(`place_id=${encodeURIComponent(testPlaceId)}`)
    expect(fetchUrl).toContain(
      "fields=name%2Cformatted_address%2Cgeometry%2Cformatted_phone_number"
    )
  })

  it("returns null for ZERO_RESULTS", async () => {
    mockFetchResponse({ status: "ZERO_RESULTS", result: null })

    const result = await getPlaceDetails(testPlaceId)

    expect(result).toBeNull()
  })

  it("throws MapsApiError for NOT_FOUND (callMapsApi rejects before places.ts handler)", async () => {
    // NOTE: callMapsApi treats NOT_FOUND as a non-retryable error and throws.
    // The NOT_FOUND check in places.ts is therefore unreachable dead code.
    mockFetchResponse({
      status: "NOT_FOUND",
      error_message: "Place not found",
      result: null,
    })

    await expect(getPlaceDetails(testPlaceId)).rejects.toThrow(MapsApiError)
  })

  it("throws PlaceDetailsFailedError when OK but no result", async () => {
    mockFetchResponse({ status: "OK", result: null })

    await expect(getPlaceDetails(testPlaceId)).rejects.toThrow(
      PlaceDetailsFailedError
    )
    await expect(getPlaceDetails(testPlaceId)).rejects.toThrow(
      "returned OK but no result"
    )
  })

  it("throws MapsApiError on REQUEST_DENIED", async () => {
    mockFetchResponse({
      status: "REQUEST_DENIED",
      error_message: "API key invalid",
      result: null,
    })

    await expect(getPlaceDetails(testPlaceId)).rejects.toThrow(MapsApiError)
  })

  it("throws MapsApiError on HTTP error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: () => Promise.resolve({}),
    })

    await expect(getPlaceDetails(testPlaceId)).rejects.toThrow(MapsApiError)
  })
})
