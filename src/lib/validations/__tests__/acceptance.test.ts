import { describe, expect, it } from "vitest"
import { rejectionSchema } from "../acceptance"

describe("rejectionSchema", () => {
  const validData = {
    ride_id: "550e8400-e29b-41d4-a716-446655440000",
    rejection_reason: "schedule_conflict",
    rejection_text: null,
  }

  it("accepts valid rejection without text", () => {
    const result = rejectionSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it("accepts valid rejection with text", () => {
    const result = rejectionSchema.safeParse({
      ...validData,
      rejection_text: "Bin an dem Tag im Urlaub",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.rejection_text).toBe("Bin an dem Tag im Urlaub")
    }
  })

  it("transforms empty string rejection_text to null", () => {
    const result = rejectionSchema.safeParse({
      ...validData,
      rejection_text: "",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.rejection_text).toBeNull()
    }
  })

  it("rejects invalid UUID for ride_id", () => {
    const result = rejectionSchema.safeParse({
      ...validData,
      ride_id: "not-a-uuid",
    })
    expect(result.success).toBe(false)
  })

  it("rejects invalid rejection_reason", () => {
    const result = rejectionSchema.safeParse({
      ...validData,
      rejection_reason: "invalid_reason",
    })
    expect(result.success).toBe(false)
  })

  it("accepts all valid rejection reasons", () => {
    const reasons = [
      "schedule_conflict",
      "too_far",
      "vehicle_issue",
      "personal",
      "other",
    ]
    for (const reason of reasons) {
      const result = rejectionSchema.safeParse({
        ...validData,
        rejection_reason: reason,
      })
      expect(result.success).toBe(true)
    }
  })

  it("rejects rejection_text over 200 characters", () => {
    const result = rejectionSchema.safeParse({
      ...validData,
      rejection_text: "x".repeat(201),
    })
    expect(result.success).toBe(false)
  })

  it("accepts rejection_text at exactly 200 characters", () => {
    const result = rejectionSchema.safeParse({
      ...validData,
      rejection_text: "x".repeat(200),
    })
    expect(result.success).toBe(true)
  })

  it("rejects missing ride_id", () => {
    const { ride_id, ...data } = validData
    const result = rejectionSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it("rejects missing rejection_reason", () => {
    const { rejection_reason, ...data } = validData
    const result = rejectionSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})
