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

import { getRoute } from "../directions"
import { DirectionsFailedError, MapsApiError } from "../errors"

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const origin = { lat: 47.397, lng: 8.651 }
const destination = { lat: 47.378, lng: 8.540 }

const successApiResponse = {
  status: "OK",
  routes: [
    {
      legs: [
        {
          distance: { value: 12500 },
          duration: { value: 1080 },
        },
      ],
      overview_polyline: { points: "encodedPolyline123" },
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
// Tests
// ---------------------------------------------------------------------------

describe("getRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GOOGLE_MAPS_API_KEY = "test-api-key"
  })

  it("returns route result on success", async () => {
    mockFetchResponse(successApiResponse)

    const result = await getRoute(origin, destination)

    expect(result).toEqual({
      distance_meters: 12500,
      duration_seconds: 1080,
      polyline: "encodedPolyline123",
    })
  })

  it("passes origin and destination as lat,lng params", async () => {
    mockFetchResponse(successApiResponse)

    await getRoute(origin, destination)

    const fetchUrl = mockFetch.mock.calls[0]?.[0] as string
    expect(fetchUrl).toContain("origin=47.397%2C8.651")
    expect(fetchUrl).toContain("destination=47.378%2C8.54")
    expect(fetchUrl).toContain("mode=driving")
  })

  it("throws DirectionsFailedError when no routes returned", async () => {
    mockFetchResponse({ status: "OK", routes: [] })

    await expect(getRoute(origin, destination)).rejects.toThrow(
      DirectionsFailedError
    )
    await expect(getRoute(origin, destination)).rejects.toThrow(
      "Directions API returned no routes"
    )
  })

  it("throws DirectionsFailedError when route has no legs", async () => {
    mockFetchResponse({
      status: "OK",
      routes: [{ legs: [], overview_polyline: { points: "" } }],
    })

    await expect(getRoute(origin, destination)).rejects.toThrow(
      DirectionsFailedError
    )
    await expect(getRoute(origin, destination)).rejects.toThrow(
      "route with no legs"
    )
  })

  it("throws MapsApiError on NOT_FOUND status", async () => {
    mockFetchResponse({
      status: "NOT_FOUND",
      error_message: "Origin not found",
      routes: [],
    })

    await expect(getRoute(origin, destination)).rejects.toThrow(MapsApiError)
  })

  it("throws MapsApiError on HTTP error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      json: () => Promise.resolve({}),
    })

    await expect(getRoute(origin, destination)).rejects.toThrow(MapsApiError)
  })

  it("throws MapsApiError when GOOGLE_MAPS_API_KEY is missing", async () => {
    delete process.env.GOOGLE_MAPS_API_KEY

    await expect(getRoute(origin, destination)).rejects.toThrow(MapsApiError)
  })
})
