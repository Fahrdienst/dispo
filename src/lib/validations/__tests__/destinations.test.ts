import { describe, it, expect } from "vitest"
import { destinationSchema } from "../destinations"

const validDestination = {
  name: "Universitätsspital Zürich",
  type: "hospital" as const,
  street: "Rämistrasse",
  house_number: "100",
  postal_code: "8091",
  city: "Zürich",
  department: "Radiologie",
  notes: "",
}

describe("destinationSchema", () => {
  it("accepts valid input", () => {
    const result = destinationSchema.safeParse(validDestination)
    expect(result.success).toBe(true)
  })

  // --- Required fields ---

  it("rejects empty name", () => {
    const result = destinationSchema.safeParse({ ...validDestination, name: "" })
    expect(result.success).toBe(false)
  })

  // --- Max length ---

  it("rejects name over 200 chars", () => {
    const result = destinationSchema.safeParse({ ...validDestination, name: "A".repeat(201) })
    expect(result.success).toBe(false)
  })

  it("rejects notes over 1000 chars", () => {
    const result = destinationSchema.safeParse({ ...validDestination, notes: "A".repeat(1001) })
    expect(result.success).toBe(false)
  })

  // --- Empty-to-null transforms ---

  it("transforms empty street to null", () => {
    const result = destinationSchema.safeParse({ ...validDestination, street: "" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.street).toBeNull()
    }
  })

  it("transforms empty house_number to null", () => {
    const result = destinationSchema.safeParse({ ...validDestination, house_number: "" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.house_number).toBeNull()
    }
  })

  it("transforms empty postal_code to null", () => {
    const result = destinationSchema.safeParse({ ...validDestination, postal_code: "" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.postal_code).toBeNull()
    }
  })

  it("transforms empty city to null", () => {
    const result = destinationSchema.safeParse({ ...validDestination, city: "" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.city).toBeNull()
    }
  })

  it("transforms empty department to null", () => {
    const result = destinationSchema.safeParse({ ...validDestination, department: "" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.department).toBeNull()
    }
  })

  it("transforms empty notes to null", () => {
    const result = destinationSchema.safeParse({ ...validDestination, notes: "" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.notes).toBeNull()
    }
  })

  it("preserves non-empty optional values", () => {
    const result = destinationSchema.safeParse(validDestination)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.street).toBe("Rämistrasse")
      expect(result.data.department).toBe("Radiologie")
    }
  })

  // --- Type enum ---

  it("accepts all valid destination types", () => {
    for (const type of ["hospital", "doctor", "therapy", "other"] as const) {
      const result = destinationSchema.safeParse({ ...validDestination, type })
      expect(result.success).toBe(true)
    }
  })

  it("rejects invalid destination type", () => {
    const result = destinationSchema.safeParse({ ...validDestination, type: "pharmacy" })
    expect(result.success).toBe(false)
  })

  it("defaults type to other when omitted", () => {
    const { type: _, ...withoutType } = validDestination
    const result = destinationSchema.safeParse(withoutType)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.type).toBe("other")
    }
  })
})
