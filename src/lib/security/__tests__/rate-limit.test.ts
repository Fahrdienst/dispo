import { describe, it, expect, vi, beforeEach } from "vitest"
import { rateLimit, rateLimitLogin, rateLimitRideRespond, rateLimitBillingExport } from "../rate-limit"

describe("rateLimit", () => {
  beforeEach(() => {
    // Reset Date.now mock between tests
    vi.restoreAllMocks()
  })

  const config = { maxRequests: 3, windowMs: 10_000 }

  it("allows requests under the limit", () => {
    const key = `test-under-${Date.now()}-${Math.random()}`
    const r1 = rateLimit(key, config)
    expect(r1.success).toBe(true)
    expect(r1.remaining).toBe(2)

    const r2 = rateLimit(key, config)
    expect(r2.success).toBe(true)
    expect(r2.remaining).toBe(1)

    const r3 = rateLimit(key, config)
    expect(r3.success).toBe(true)
    expect(r3.remaining).toBe(0)
  })

  it("blocks requests over the limit", () => {
    const key = `test-over-${Date.now()}-${Math.random()}`

    // Exhaust the limit
    rateLimit(key, config)
    rateLimit(key, config)
    rateLimit(key, config)

    // Fourth request should be blocked
    const result = rateLimit(key, config)
    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it("resets after window expires", () => {
    const key = `test-reset-${Math.random()}`
    const baseTime = 1000000

    // Mock Date.now for deterministic testing
    vi.spyOn(Date, "now").mockReturnValue(baseTime)

    // Exhaust the limit
    rateLimit(key, config)
    rateLimit(key, config)
    rateLimit(key, config)
    const blocked = rateLimit(key, config)
    expect(blocked.success).toBe(false)

    // Advance time past the window
    vi.spyOn(Date, "now").mockReturnValue(baseTime + config.windowMs + 1)

    // Should be allowed again
    const afterReset = rateLimit(key, config)
    expect(afterReset.success).toBe(true)
    expect(afterReset.remaining).toBe(2)
  })

  it("returns correct resetAt timestamp", () => {
    const key = `test-reset-at-${Math.random()}`
    const now = 1000000
    vi.spyOn(Date, "now").mockReturnValue(now)

    const result = rateLimit(key, config)
    expect(result.resetAt).toBe(now + config.windowMs)
  })

  it("uses separate counters for different keys", () => {
    const keyA = `test-key-a-${Math.random()}`
    const keyB = `test-key-b-${Math.random()}`

    // Exhaust keyA
    rateLimit(keyA, config)
    rateLimit(keyA, config)
    rateLimit(keyA, config)

    // keyB should still be available
    const resultB = rateLimit(keyB, config)
    expect(resultB.success).toBe(true)
    expect(resultB.remaining).toBe(2)

    // keyA should be blocked
    const resultA = rateLimit(keyA, config)
    expect(resultA.success).toBe(false)
  })

  it("handles maxRequests of 1 (single request allowed)", () => {
    const key = `test-single-${Math.random()}`
    const singleConfig = { maxRequests: 1, windowMs: 5000 }

    const first = rateLimit(key, singleConfig)
    expect(first.success).toBe(true)
    expect(first.remaining).toBe(0)

    const second = rateLimit(key, singleConfig)
    expect(second.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Pre-configured limiters
// ---------------------------------------------------------------------------

describe("rateLimitLogin", () => {
  it("normalizes email to lowercase and trimmed", () => {
    const key1 = `login-test-${Math.random()}@example.com`
    const key2 = key1.toUpperCase()

    const r1 = rateLimitLogin(key1)
    const r2 = rateLimitLogin(key2)

    // Both should hit the same counter, so r2.remaining should be r1.remaining - 1
    expect(r2.remaining).toBe(r1.remaining - 1)
  })

  it("returns success for first request", () => {
    const email = `fresh-${Math.random()}@example.com`
    const result = rateLimitLogin(email)
    expect(result.success).toBe(true)
  })
})

describe("rateLimitRideRespond", () => {
  it("returns success for first request", () => {
    const ip = `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`
    const result = rateLimitRideRespond(ip)
    expect(result.success).toBe(true)
  })
})

describe("rateLimitBillingExport", () => {
  it("returns success for first request", () => {
    const userId = `user-${Math.random()}`
    const result = rateLimitBillingExport(userId)
    expect(result.success).toBe(true)
  })
})
