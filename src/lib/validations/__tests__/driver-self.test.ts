import { describe, it, expect } from "vitest"
import { driverSelfContactSchema } from "../driver-self"

function makeContact(
  overrides: Partial<Record<string, unknown>> = {}
) {
  return {
    phone: "044 123 45 67",
    email: "fahrer@example.com",
    street: "Bahnhofstrasse",
    house_number: "12a",
    postal_code: "8600",
    city: "Dübendorf",
    ...overrides,
  }
}

describe("driverSelfContactSchema", () => {
  // --- Happy path ---

  it("accepts a fully populated contact", () => {
    const result = driverSelfContactSchema.safeParse(makeContact())
    expect(result.success).toBe(true)
  })

  // --- Whitelist: ONLY the six self-editable fields survive parsing ---

  it("strips any non-whitelisted key (e.g. is_active, vehicle_type, driver_id)", () => {
    const result = driverSelfContactSchema.safeParse({
      ...makeContact(),
      is_active: false,
      vehicle_type: "bus",
      driver_id: "attacker-driver-id",
      role: "operator",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(Object.keys(result.data).sort()).toEqual([
        "city",
        "email",
        "house_number",
        "phone",
        "postal_code",
        "street",
      ])
      expect(result.data).not.toHaveProperty("is_active")
      expect(result.data).not.toHaveProperty("vehicle_type")
      expect(result.data).not.toHaveProperty("driver_id")
      expect(result.data).not.toHaveProperty("role")
    }
  })

  it("exposes exactly six keys and nothing more", () => {
    const result = driverSelfContactSchema.safeParse(makeContact())
    expect(result.success).toBe(true)
    if (result.success) {
      expect(Object.keys(result.data)).toHaveLength(6)
    }
  })

  // --- empty→null on every field ---

  it("coerces every empty field to null (clears the column)", () => {
    const result = driverSelfContactSchema.safeParse({
      phone: "",
      email: "",
      street: "",
      house_number: "",
      postal_code: "",
      city: "",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({
        phone: null,
        email: null,
        street: null,
        house_number: null,
        postal_code: null,
        city: null,
      })
    }
  })

  it("coerces a whitespace-only field to null", () => {
    const result = driverSelfContactSchema.safeParse(makeContact({ phone: "   " }))
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.phone).toBeNull()
    }
  })

  // --- email format ---

  it("rejects a malformed email", () => {
    const result = driverSelfContactSchema.safeParse(
      makeContact({ email: "not-an-email" })
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.email).toContain(
        "Ungültige E-Mail-Adresse"
      )
    }
  })

  it("accepts an empty email (email is optional and clears to null)", () => {
    const result = driverSelfContactSchema.safeParse(makeContact({ email: "" }))
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBeNull()
    }
  })

  it("rejects an email longer than 255 characters", () => {
    const longEmail = `${"x".repeat(250)}@example.com`
    const result = driverSelfContactSchema.safeParse(
      makeContact({ email: longEmail })
    )
    expect(result.success).toBe(false)
  })

  // --- postal_code (Swiss 4-digit) ---

  it("rejects a non-4-digit postal code", () => {
    const result = driverSelfContactSchema.safeParse(
      makeContact({ postal_code: "860" })
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.postal_code).toContain(
        "PLZ muss 4-stellig sein (CH)"
      )
    }
  })

  it("rejects a postal code with letters", () => {
    const result = driverSelfContactSchema.safeParse(
      makeContact({ postal_code: "86AB" })
    )
    expect(result.success).toBe(false)
  })

  it("accepts an empty postal code (clears to null)", () => {
    const result = driverSelfContactSchema.safeParse(
      makeContact({ postal_code: "" })
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.postal_code).toBeNull()
    }
  })

  // --- length guards ---

  it("rejects an over-long phone number", () => {
    const result = driverSelfContactSchema.safeParse(
      makeContact({ phone: "1".repeat(51) })
    )
    expect(result.success).toBe(false)
  })

  it("rejects an over-long city", () => {
    const result = driverSelfContactSchema.safeParse(
      makeContact({ city: "x".repeat(101) })
    )
    expect(result.success).toBe(false)
  })

  it("rejects an over-long street", () => {
    const result = driverSelfContactSchema.safeParse(
      makeContact({ street: "x".repeat(201) })
    )
    expect(result.success).toBe(false)
  })
})
