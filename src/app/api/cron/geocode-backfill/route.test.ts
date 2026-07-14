import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const { mockBatch, mockAdmin } = vi.hoisted(() => ({
  mockBatch: vi.fn(),
  mockAdmin: vi.fn(() => ({})),
}))

vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mockAdmin }))
vi.mock("@/lib/maps/geocode-batch", () => ({ processGeocodingBatch: mockBatch }))

import { GET } from "./route"

function req(auth?: string): Request {
  return new Request("https://x/api/cron/geocode-backfill", {
    headers: auth ? { authorization: auth } : {},
  })
}

describe("geocode-backfill cron route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = "s3cret"
  })
  afterEach(() => {
    delete process.env.CRON_SECRET
  })

  it("returns 401 without an authorization header", async () => {
    const res = await GET(req())
    expect(res.status).toBe(401)
    expect(mockBatch).not.toHaveBeenCalled()
  })

  it("returns 401 with a wrong secret", async () => {
    const res = await GET(req("Bearer nope"))
    expect(res.status).toBe(401)
    expect(mockBatch).not.toHaveBeenCalled()
  })

  it("returns 401 when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET
    const res = await GET(req("Bearer s3cret"))
    expect(res.status).toBe(401)
  })

  it("processes a single batch and returns aggregated counts", async () => {
    mockBatch.mockResolvedValue({
      processed: 3, succeeded: 3, failed: 0, remaining: 0, cursor: "c1", errors: [],
    })

    const res = await GET(req("Bearer s3cret"))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({ success: true, processed: 3, succeeded: 3, failed: 0, remaining: 0 })
    expect(mockBatch).toHaveBeenCalledTimes(1)
  })

  it("loops across batches until remaining reaches 0", async () => {
    mockBatch
      .mockResolvedValueOnce({ processed: 50, succeeded: 48, failed: 2, remaining: 10, cursor: "c1", errors: [] })
      .mockResolvedValueOnce({ processed: 10, succeeded: 10, failed: 0, remaining: 0, cursor: "c1", errors: [] })

    const res = await GET(req("Bearer s3cret"))
    const body = await res.json()

    expect(mockBatch).toHaveBeenCalledTimes(2)
    // Second call reuses the cursor from the first.
    expect(mockBatch.mock.calls[1]?.[2]).toBe("c1")
    expect(body).toMatchObject({ processed: 60, succeeded: 58, failed: 2, remaining: 0 })
  })

  it("returns 500 when the batch throws", async () => {
    mockBatch.mockRejectedValue(new Error("boom"))
    const res = await GET(req("Bearer s3cret"))
    expect(res.status).toBe(500)
  })
})
