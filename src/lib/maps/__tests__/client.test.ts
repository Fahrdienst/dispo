import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }))

vi.mock("server-only", () => ({}))
vi.stubGlobal("fetch", mockFetch)

import { callMapsApi } from "../client"
import { MapsApiError } from "../errors"

const URL = "https://maps.googleapis.com/maps/api/geocode/json"

function okResponse(): void {
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    json: () => Promise.resolve({ status: "OK" }),
  })
}

/** Extract the `key` query param from the URL the fetch mock was called with. */
function usedKey(): string | null {
  const url = mockFetch.mock.calls[0]?.[0] as string
  return new global.URL(url).searchParams.get("key")
}

describe("callMapsApi key selection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.GOOGLE_MAPS_SERVER_API_KEY
    delete process.env.GOOGLE_MAPS_API_KEY
  })

  afterEach(() => {
    // Don't leak env into other test files
    delete process.env.GOOGLE_MAPS_SERVER_API_KEY
    delete process.env.GOOGLE_MAPS_API_KEY
    vi.restoreAllMocks()
  })

  it("uses GOOGLE_MAPS_SERVER_API_KEY when set", async () => {
    okResponse()
    process.env.GOOGLE_MAPS_SERVER_API_KEY = "server-key"

    await callMapsApi(URL, { address: "x" })

    expect(usedKey()).toBe("server-key")
  })

  it("prefers the server key over the legacy key when both are set", async () => {
    okResponse()
    process.env.GOOGLE_MAPS_SERVER_API_KEY = "server-key"
    process.env.GOOGLE_MAPS_API_KEY = "legacy-key"

    await callMapsApi(URL, { address: "x" })

    expect(usedKey()).toBe("server-key")
  })

  it("falls back to GOOGLE_MAPS_API_KEY with a warning when server key is unset", async () => {
    okResponse()
    process.env.GOOGLE_MAPS_API_KEY = "legacy-key"
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    await callMapsApi(URL, { address: "x" })

    expect(usedKey()).toBe("legacy-key")
    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0]?.[0]).toContain("GOOGLE_MAPS_SERVER_API_KEY")
  })

  it("throws MapsApiError when neither key is configured", async () => {
    okResponse()

    await expect(callMapsApi(URL, { address: "x" })).rejects.toThrow(MapsApiError)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
