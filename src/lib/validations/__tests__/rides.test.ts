import { describe, it, expect } from "vitest"
import { rideSchema } from "../rides"

const validRide = {
  patient_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  destination_id: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
  driver_id: "",
  date: "2026-03-15",
  pickup_time: "08:30",
  direction: "outbound" as const,
  notes: "",
}

describe("rideSchema", () => {
  it("accepts valid input", () => {
    const result = rideSchema.safeParse(validRide)
    expect(result.success).toBe(true)
  })

  // --- Required fields ---

  it("rejects missing patient_id", () => {
    const result = rideSchema.safeParse({ ...validRide, patient_id: "" })
    expect(result.success).toBe(false)
  })

  it("rejects non-uuid patient_id", () => {
    const result = rideSchema.safeParse({ ...validRide, patient_id: "not-a-uuid" })
    expect(result.success).toBe(false)
  })

  it("rejects missing destination_id", () => {
    const result = rideSchema.safeParse({ ...validRide, destination_id: "" })
    expect(result.success).toBe(false)
  })

  it("rejects empty date", () => {
    const result = rideSchema.safeParse({ ...validRide, date: "" })
    expect(result.success).toBe(false)
  })

  it("rejects empty pickup_time", () => {
    const result = rideSchema.safeParse({ ...validRide, pickup_time: "" })
    expect(result.success).toBe(false)
  })

  // --- Empty-to-null transforms ---

  it("transforms empty driver_id to null", () => {
    const result = rideSchema.safeParse({ ...validRide, driver_id: "" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.driver_id).toBeNull()
    }
  })

  it("transforms empty notes to null", () => {
    const result = rideSchema.safeParse({ ...validRide, notes: "" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.notes).toBeNull()
    }
  })

  it("preserves valid driver_id", () => {
    const driverId = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33"
    const result = rideSchema.safeParse({ ...validRide, driver_id: driverId })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.driver_id).toBe(driverId)
    }
  })

  // --- Max length ---

  it("rejects notes over 1000 chars", () => {
    const result = rideSchema.safeParse({ ...validRide, notes: "A".repeat(1001) })
    expect(result.success).toBe(false)
  })

  // --- Direction enum ---

  it("accepts all valid direction values", () => {
    for (const direction of ["outbound", "return", "both"] as const) {
      const result = rideSchema.safeParse({ ...validRide, direction })
      expect(result.success).toBe(true)
    }
  })

  it("rejects invalid direction", () => {
    const result = rideSchema.safeParse({ ...validRide, direction: "sideways" })
    expect(result.success).toBe(false)
  })

  it("defaults direction to outbound when omitted", () => {
    const { direction: _, ...withoutDirection } = validRide
    const result = rideSchema.safeParse(withoutDirection)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.direction).toBe("outbound")
    }
  })
})
