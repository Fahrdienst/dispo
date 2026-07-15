import { describe, it, expect } from "vitest"
import { RECEIPT_SIGNED_URL_TTL_SECONDS } from "@/lib/receipts/constants"

// SEC-M14-005 (HIGH): receipt-PDF signed URLs must be short-lived (≤ 5 min),
// NOT the long-lived `feedback` pattern. This pins the hard ceiling so a future
// change cannot silently widen it.
describe("RECEIPT_SIGNED_URL_TTL_SECONDS", () => {
  it("never exceeds the 5-minute ceiling (SEC-M14-005)", () => {
    expect(RECEIPT_SIGNED_URL_TTL_SECONDS).toBeLessThanOrEqual(300)
  })

  it("is a positive, sane TTL", () => {
    expect(RECEIPT_SIGNED_URL_TTL_SECONDS).toBeGreaterThan(0)
  })
})
