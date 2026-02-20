import { describe, it, expect } from "vitest"
import { driverSchema } from "../drivers"

const validDriver = {
  first_name: "Hans",
  last_name: "Meier",
  phone: "+41 79 111 22 33",
  vehicle_type: "standard" as const,
  street: "Bahnhofstrasse",
  house_number: "10",
  postal_code: "8001",
  city: "Zuerich",
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

  it("rejects empty street", () => {
    const result = driverSchema.safeParse({ ...validDriver, street: "" })
    expect(result.success).toBe(false)
  })

  it("rejects empty house_number", () => {
    const result = driverSchema.safeParse({ ...validDriver, house_number: "" })
    expect(result.success).toBe(false)
  })

  it("rejects empty postal_code", () => {
    const result = driverSchema.safeParse({ ...validDriver, postal_code: "" })
    expect(result.success).toBe(false)
  })

  it("rejects empty city", () => {
    const result = driverSchema.safeParse({ ...validDriver, city: "" })
    expect(result.success).toBe(false)
  })

  // --- CH postal code validation ---

  it("accepts 4-digit postal code", () => {
    const result = driverSchema.safeParse({ ...validDriver, postal_code: "3000" })
    expect(result.success).toBe(true)
  })

  it("rejects 3-digit postal code", () => {
    const result = driverSchema.safeParse({ ...validDriver, postal_code: "800" })
    expect(result.success).toBe(false)
  })

  it("rejects 5-digit postal code", () => {
    const result = driverSchema.safeParse({ ...validDriver, postal_code: "80015" })
    expect(result.success).toBe(false)
  })

  it("rejects non-numeric postal code", () => {
    const result = driverSchema.safeParse({ ...validDriver, postal_code: "ABCD" })
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

  it("rejects vehicle over 200 chars", () => {
    const result = driverSchema.safeParse({ ...validDriver, vehicle: "A".repeat(201) })
    expect(result.success).toBe(false)
  })

  it("rejects driving_license over 100 chars", () => {
    const result = driverSchema.safeParse({ ...validDriver, driving_license: "A".repeat(101) })
    expect(result.success).toBe(false)
  })

  it("rejects street over 200 chars", () => {
    const result = driverSchema.safeParse({ ...validDriver, street: "A".repeat(201) })
    expect(result.success).toBe(false)
  })

  it("rejects house_number over 20 chars", () => {
    const result = driverSchema.safeParse({ ...validDriver, house_number: "A".repeat(21) })
    expect(result.success).toBe(false)
  })

  it("rejects city over 100 chars", () => {
    const result = driverSchema.safeParse({ ...validDriver, city: "A".repeat(101) })
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

  it("transforms empty vehicle to null", () => {
    const result = driverSchema.safeParse({ ...validDriver, vehicle: "" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.vehicle).toBeNull()
    }
  })

  it("transforms empty driving_license to null", () => {
    const result = driverSchema.safeParse({ ...validDriver, driving_license: "" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.driving_license).toBeNull()
    }
  })

  it("transforms empty emergency_contact_name to null", () => {
    const result = driverSchema.safeParse({ ...validDriver, emergency_contact_name: "" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.emergency_contact_name).toBeNull()
    }
  })

  it("transforms empty emergency_contact_phone to null", () => {
    const result = driverSchema.safeParse({ ...validDriver, emergency_contact_phone: "" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.emergency_contact_phone).toBeNull()
    }
  })

  it("preserves non-empty phone", () => {
    const result = driverSchema.safeParse(validDriver)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.phone).toBe("+41 79 111 22 33")
    }
  })

  // --- Email validation ---

  it("accepts valid email", () => {
    const result = driverSchema.safeParse({ ...validDriver, email: "hans@example.com" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBe("hans@example.com")
    }
  })

  it("rejects invalid email", () => {
    const result = driverSchema.safeParse({ ...validDriver, email: "not-an-email" })
    expect(result.success).toBe(false)
  })

  it("transforms empty email to null", () => {
    const result = driverSchema.safeParse({ ...validDriver, email: "" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBeNull()
    }
  })

  it("allows email to be omitted", () => {
    const result = driverSchema.safeParse(validDriver)
    expect(result.success).toBe(true)
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
