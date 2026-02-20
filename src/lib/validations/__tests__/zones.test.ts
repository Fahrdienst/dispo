import { describe, it, expect } from "vitest"
import { zoneSchema, zonePostalCodeSchema } from "../zones"

// ---------------------------------------------------------------------------
// Tests: zoneSchema
// ---------------------------------------------------------------------------

describe("zoneSchema", () => {
  const validZone = {
    name: "Duebendorf",
    description: "Raum Duebendorf",
  }

  it("accepts valid input", () => {
    const result = zoneSchema.safeParse(validZone)
    expect(result.success).toBe(true)
  })

  it("accepts input without description", () => {
    const result = zoneSchema.safeParse({ name: "Zuerich" })
    expect(result.success).toBe(true)
  })

  it("rejects empty name", () => {
    const result = zoneSchema.safeParse({ ...validZone, name: "" })
    expect(result.success).toBe(false)
  })

  it("rejects name over 100 chars", () => {
    const result = zoneSchema.safeParse({
      ...validZone,
      name: "A".repeat(101),
    })
    expect(result.success).toBe(false)
  })

  it("accepts name at exactly 100 chars", () => {
    const result = zoneSchema.safeParse({
      ...validZone,
      name: "A".repeat(100),
    })
    expect(result.success).toBe(true)
  })

  it("rejects description over 500 chars", () => {
    const result = zoneSchema.safeParse({
      ...validZone,
      description: "A".repeat(501),
    })
    expect(result.success).toBe(false)
  })

  it("transforms empty description to null", () => {
    const result = zoneSchema.safeParse({ ...validZone, description: "" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.description).toBeNull()
    }
  })
})

// ---------------------------------------------------------------------------
// Tests: zonePostalCodeSchema
// ---------------------------------------------------------------------------

describe("zonePostalCodeSchema", () => {
  it("accepts valid 4-digit CH postal code", () => {
    const result = zonePostalCodeSchema.safeParse({ postal_code: "8600" })
    expect(result.success).toBe(true)
  })

  it("accepts postal code 1000", () => {
    const result = zonePostalCodeSchema.safeParse({ postal_code: "1000" })
    expect(result.success).toBe(true)
  })

  it("accepts postal code 9999", () => {
    const result = zonePostalCodeSchema.safeParse({ postal_code: "9999" })
    expect(result.success).toBe(true)
  })

  it("rejects empty postal code", () => {
    const result = zonePostalCodeSchema.safeParse({ postal_code: "" })
    expect(result.success).toBe(false)
  })

  it("rejects 3-digit postal code", () => {
    const result = zonePostalCodeSchema.safeParse({ postal_code: "800" })
    expect(result.success).toBe(false)
  })

  it("rejects 5-digit postal code", () => {
    const result = zonePostalCodeSchema.safeParse({ postal_code: "80015" })
    expect(result.success).toBe(false)
  })

  it("rejects non-numeric postal code", () => {
    const result = zonePostalCodeSchema.safeParse({ postal_code: "ABCD" })
    expect(result.success).toBe(false)
  })

  it("rejects postal code with letters mixed", () => {
    const result = zonePostalCodeSchema.safeParse({ postal_code: "80A1" })
    expect(result.success).toBe(false)
  })

  it("rejects postal code with spaces", () => {
    const result = zonePostalCodeSchema.safeParse({ postal_code: "86 00" })
    expect(result.success).toBe(false)
  })
})
