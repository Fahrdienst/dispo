import { describe, it, expect } from "vitest"
import { patientSchema } from "../patients"

const validPatient = {
  first_name: "Max",
  last_name: "Muster",
  phone: "+41 79 123 45 67",
  street: "Bahnhofstrasse",
  house_number: "10",
  postal_code: "8001",
  city: "Zürich",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  comment: "",
  impairments: ["wheelchair"],
  notes: "",
}

describe("patientSchema", () => {
  it("accepts valid input", () => {
    const result = patientSchema.safeParse(validPatient)
    expect(result.success).toBe(true)
  })

  // --- Required fields ---

  it("rejects empty first_name", () => {
    const result = patientSchema.safeParse({ ...validPatient, first_name: "" })
    expect(result.success).toBe(false)
  })

  it("rejects empty last_name", () => {
    const result = patientSchema.safeParse({ ...validPatient, last_name: "" })
    expect(result.success).toBe(false)
  })

  it("rejects empty street", () => {
    const result = patientSchema.safeParse({ ...validPatient, street: "" })
    expect(result.success).toBe(false)
  })

  it("rejects empty house_number", () => {
    const result = patientSchema.safeParse({ ...validPatient, house_number: "" })
    expect(result.success).toBe(false)
  })

  it("rejects empty postal_code", () => {
    const result = patientSchema.safeParse({ ...validPatient, postal_code: "" })
    expect(result.success).toBe(false)
  })

  it("rejects empty city", () => {
    const result = patientSchema.safeParse({ ...validPatient, city: "" })
    expect(result.success).toBe(false)
  })

  // --- Postal code format (CH: 4 digits) ---

  it("rejects non-4-digit postal code", () => {
    const result = patientSchema.safeParse({ ...validPatient, postal_code: "123" })
    expect(result.success).toBe(false)
  })

  it("rejects 5-digit postal code", () => {
    const result = patientSchema.safeParse({ ...validPatient, postal_code: "12345" })
    expect(result.success).toBe(false)
  })

  it("rejects alphabetic postal code", () => {
    const result = patientSchema.safeParse({ ...validPatient, postal_code: "ABCD" })
    expect(result.success).toBe(false)
  })

  // --- Max length ---

  it("rejects first_name over 100 chars", () => {
    const result = patientSchema.safeParse({ ...validPatient, first_name: "A".repeat(101) })
    expect(result.success).toBe(false)
  })

  it("rejects comment over 2000 chars", () => {
    const result = patientSchema.safeParse({ ...validPatient, comment: "A".repeat(2001) })
    expect(result.success).toBe(false)
  })

  // --- Empty-to-null transforms ---

  it("transforms empty phone to null", () => {
    const result = patientSchema.safeParse({ ...validPatient, phone: "" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.phone).toBeNull()
    }
  })

  it("transforms empty emergency_contact_name to null", () => {
    const result = patientSchema.safeParse({ ...validPatient, emergency_contact_name: "" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.emergency_contact_name).toBeNull()
    }
  })

  it("transforms empty comment to null", () => {
    const result = patientSchema.safeParse({ ...validPatient, comment: "" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.comment).toBeNull()
    }
  })

  it("transforms empty notes to null", () => {
    const result = patientSchema.safeParse({ ...validPatient, notes: "" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.notes).toBeNull()
    }
  })

  it("preserves non-empty optional values", () => {
    const result = patientSchema.safeParse({ ...validPatient, phone: "+41 79 000 00 00" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.phone).toBe("+41 79 000 00 00")
    }
  })

  // --- Impairments enum ---

  it("accepts valid impairment values", () => {
    const result = patientSchema.safeParse({
      ...validPatient,
      impairments: ["rollator", "wheelchair", "stretcher", "companion"],
    })
    expect(result.success).toBe(true)
  })

  it("rejects invalid impairment value", () => {
    const result = patientSchema.safeParse({ ...validPatient, impairments: ["invalid"] })
    expect(result.success).toBe(false)
  })

  it("defaults impairments to empty array when omitted", () => {
    const { impairments: _, ...withoutImpairments } = validPatient
    const result = patientSchema.safeParse(withoutImpairments)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.impairments).toEqual([])
    }
  })
})
