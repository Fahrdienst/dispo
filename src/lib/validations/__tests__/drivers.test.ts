import { describe, it, expect } from "vitest"
import { driverSchema } from "../drivers"

const validDriver = {
  first_name: "Hans",
  last_name: "Meier",
  phone: "+41 79 111 22 33",
  vehicle_type: "standard" as const,
  notes: "",
}

describe("driverSchema", () => {
  it("accepts valid input", () => {
    const result = driverSchema.safeParse(validDriver)
    expect(result.success).toBe(true)
  })

  // --- Required fields ---

  it("rejects empty first_name", () => {
    const result = driverSchema.safeParse({ ...validDriver, first_name: "" })
    expect(result.success).toBe(false)
  })

  it("rejects empty last_name", () => {
    const result = driverSchema.safeParse({ ...validDriver, last_name: "" })
    expect(result.success).toBe(false)
  })

  // --- Max length ---

  it("rejects first_name over 100 chars", () => {
    const result = driverSchema.safeParse({ ...validDriver, first_name: "A".repeat(101) })
    expect(result.success).toBe(false)
  })

  it("rejects notes over 1000 chars", () => {
    const result = driverSchema.safeParse({ ...validDriver, notes: "A".repeat(1001) })
    expect(result.success).toBe(false)
  })

  // --- Empty-to-null transforms ---

  it("transforms empty phone to null", () => {
    const result = driverSchema.safeParse({ ...validDriver, phone: "" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.phone).toBeNull()
    }
  })

  it("transforms empty notes to null", () => {
    const result = driverSchema.safeParse({ ...validDriver, notes: "" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.notes).toBeNull()
    }
  })

  it("preserves non-empty phone", () => {
    const result = driverSchema.safeParse(validDriver)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.phone).toBe("+41 79 111 22 33")
    }
  })

  // --- Vehicle type enum ---

  it("accepts all valid vehicle types", () => {
    for (const type of ["standard", "wheelchair", "stretcher"] as const) {
      const result = driverSchema.safeParse({ ...validDriver, vehicle_type: type })
      expect(result.success).toBe(true)
    }
  })

  it("rejects invalid vehicle type", () => {
    const result = driverSchema.safeParse({ ...validDriver, vehicle_type: "bus" })
    expect(result.success).toBe(false)
  })

  it("defaults vehicle_type to standard when omitted", () => {
    const { vehicle_type: _, ...withoutType } = validDriver
    const result = driverSchema.safeParse(withoutType)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.vehicle_type).toBe("standard")
    }
  })
})
