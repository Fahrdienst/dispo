import { describe, it, expect } from "vitest"
import { destinationSchema } from "../destinations"

const validDestination = {
  display_name: "Universitaetsspital Zuerich",
  facility_type: "hospital" as const,
  contact_first_name: "Anna",
  contact_last_name: "Mueller",
  contact_phone: "044 255 11 11",
  street: "Raemistrasse",
  house_number: "100",
  postal_code: "8091",
  city: "Zuerich",
  department: "Radiologie",
  comment: "",
}

describe("destinationSchema", () => {
  it("accepts valid input", () => {
    const result = destinationSchema.safeParse(validDestination)
    expect(result.success).toBe(true)
  })

  it("rejects empty display_name", () => {
    const result = destinationSchema.safeParse({ ...validDestination, display_name: "" })
    expect(result.success).toBe(false)
  })

  it("rejects empty contact_first_name", () => {
    const result = destinationSchema.safeParse({ ...validDestination, contact_first_name: "" })
    expect(result.success).toBe(false)
  })

  it("rejects empty contact_last_name", () => {
    const result = destinationSchema.safeParse({ ...validDestination, contact_last_name: "" })
    expect(result.success).toBe(false)
  })

  it("rejects empty contact_phone", () => {
    const result = destinationSchema.safeParse({ ...validDestination, contact_phone: "" })
    expect(result.success).toBe(false)
  })

  it("rejects empty street", () => {
    const result = destinationSchema.safeParse({ ...validDestination, street: "" })
    expect(result.success).toBe(false)
  })

  it("rejects empty house_number", () => {
    const result = destinationSchema.safeParse({ ...validDestination, house_number: "" })
    expect(result.success).toBe(false)
  })

  it("rejects empty postal_code", () => {
    const result = destinationSchema.safeParse({ ...validDestination, postal_code: "" })
    expect(result.success).toBe(false)
  })

  it("rejects empty city", () => {
    const result = destinationSchema.safeParse({ ...validDestination, city: "" })
    expect(result.success).toBe(false)
  })

  it("accepts valid 4-digit CH postal code", () => {
    const result = destinationSchema.safeParse({ ...validDestination, postal_code: "3000" })
    expect(result.success).toBe(true)
  })

  it("rejects 5-digit postal code", () => {
    const result = destinationSchema.safeParse({ ...validDestination, postal_code: "80911" })
    expect(result.success).toBe(false)
  })

  it("rejects 3-digit postal code", () => {
    const result = destinationSchema.safeParse({ ...validDestination, postal_code: "809" })
    expect(result.success).toBe(false)
  })

  it("rejects postal code with letters", () => {
    const result = destinationSchema.safeParse({ ...validDestination, postal_code: "AB12" })
    expect(result.success).toBe(false)
  })

  it("rejects display_name over 200 chars", () => {
    const result = destinationSchema.safeParse({ ...validDestination, display_name: "A".repeat(201) })
    expect(result.success).toBe(false)
  })

  it("rejects contact_first_name over 100 chars", () => {
    const result = destinationSchema.safeParse({ ...validDestination, contact_first_name: "A".repeat(101) })
    expect(result.success).toBe(false)
  })

  it("rejects contact_last_name over 100 chars", () => {
    const result = destinationSchema.safeParse({ ...validDestination, contact_last_name: "A".repeat(101) })
    expect(result.success).toBe(false)
  })

  it("rejects contact_phone over 50 chars", () => {
    const result = destinationSchema.safeParse({ ...validDestination, contact_phone: "1".repeat(51) })
    expect(result.success).toBe(false)
  })

  it("rejects comment over 2000 chars", () => {
    const result = destinationSchema.safeParse({ ...validDestination, comment: "A".repeat(2001) })
    expect(result.success).toBe(false)
  })

  it("transforms empty department to null", () => {
    const result = destinationSchema.safeParse({ ...validDestination, department: "" })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.department).toBeNull()
  })

  it("transforms empty comment to null", () => {
    const result = destinationSchema.safeParse({ ...validDestination, comment: "" })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.comment).toBeNull()
  })

  it("preserves non-empty optional values", () => {
    const result = destinationSchema.safeParse(validDestination)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.department).toBe("Radiologie")
  })

  it("accepts all valid facility types", () => {
    for (const ft of ["practice", "hospital", "therapy_center", "day_care", "other"] as const) {
      const result = destinationSchema.safeParse({ ...validDestination, facility_type: ft })
      expect(result.success).toBe(true)
    }
  })

  it("rejects invalid facility type", () => {
    const result = destinationSchema.safeParse({ ...validDestination, facility_type: "pharmacy" })
    expect(result.success).toBe(false)
  })

  it("defaults facility_type to other when omitted", () => {
    const { facility_type: _, ...withoutType } = validDestination
    const result = destinationSchema.safeParse(withoutType)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.facility_type).toBe("other")
  })
})
