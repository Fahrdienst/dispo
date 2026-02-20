import { describe, it, expect } from "vitest"
import { fareVersionSchema, fareRuleSchema } from "../fares"

// ---------------------------------------------------------------------------
// Tests: fareVersionSchema
// ---------------------------------------------------------------------------

describe("fareVersionSchema", () => {
  const validVersion = {
    name: "Tarif 2026",
    valid_from: "2026-01-01",
    valid_to: "",
  }

  it("accepts valid input", () => {
    const result = fareVersionSchema.safeParse(validVersion)
    expect(result.success).toBe(true)
  })

  it("accepts input with valid_to", () => {
    const result = fareVersionSchema.safeParse({
      ...validVersion,
      valid_to: "2026-12-31",
    })
    expect(result.success).toBe(true)
  })

  it("transforms empty valid_to to null", () => {
    const result = fareVersionSchema.safeParse(validVersion)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.valid_to).toBeNull()
    }
  })

  it("rejects empty name", () => {
    const result = fareVersionSchema.safeParse({ ...validVersion, name: "" })
    expect(result.success).toBe(false)
  })

  it("rejects name over 100 chars", () => {
    const result = fareVersionSchema.safeParse({
      ...validVersion,
      name: "A".repeat(101),
    })
    expect(result.success).toBe(false)
  })

  it("rejects empty valid_from", () => {
    const result = fareVersionSchema.safeParse({
      ...validVersion,
      valid_from: "",
    })
    expect(result.success).toBe(false)
  })

  it("rejects valid_to before valid_from", () => {
    const result = fareVersionSchema.safeParse({
      ...validVersion,
      valid_from: "2026-06-01",
      valid_to: "2026-01-01",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("valid_to"))
      expect(issue).toBeDefined()
      expect(issue?.message).toBe(
        "Gueltig bis muss nach Gueltig ab liegen"
      )
    }
  })

  it("rejects valid_to equal to valid_from", () => {
    const result = fareVersionSchema.safeParse({
      ...validVersion,
      valid_from: "2026-06-01",
      valid_to: "2026-06-01",
    })
    expect(result.success).toBe(false)
  })

  it("accepts valid_to after valid_from", () => {
    const result = fareVersionSchema.safeParse({
      ...validVersion,
      valid_from: "2026-01-01",
      valid_to: "2026-12-31",
    })
    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Tests: fareRuleSchema
// ---------------------------------------------------------------------------

describe("fareRuleSchema", () => {
  const validRule = {
    from_zone_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    to_zone_id: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
    base_price: "25.00",
    price_per_km: "2.50",
  }

  it("accepts valid input", () => {
    const result = fareRuleSchema.safeParse(validRule)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.base_price).toBe(25.0)
      expect(result.data.price_per_km).toBe(2.5)
    }
  })

  it("accepts zero base_price", () => {
    const result = fareRuleSchema.safeParse({ ...validRule, base_price: "0" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.base_price).toBe(0)
    }
  })

  it("accepts zero price_per_km", () => {
    const result = fareRuleSchema.safeParse({
      ...validRule,
      price_per_km: "0",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.price_per_km).toBe(0)
    }
  })

  it("defaults empty price_per_km to 0", () => {
    const result = fareRuleSchema.safeParse({
      ...validRule,
      price_per_km: "",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.price_per_km).toBe(0)
    }
  })

  it("rejects negative base_price", () => {
    const result = fareRuleSchema.safeParse({
      ...validRule,
      base_price: "-5",
    })
    expect(result.success).toBe(false)
  })

  it("rejects negative price_per_km", () => {
    const result = fareRuleSchema.safeParse({
      ...validRule,
      price_per_km: "-1.5",
    })
    expect(result.success).toBe(false)
  })

  it("rejects non-numeric base_price", () => {
    const result = fareRuleSchema.safeParse({
      ...validRule,
      base_price: "abc",
    })
    expect(result.success).toBe(false)
  })

  it("rejects empty base_price", () => {
    const result = fareRuleSchema.safeParse({
      ...validRule,
      base_price: "",
    })
    expect(result.success).toBe(false)
  })

  it("rejects invalid from_zone_id (not UUID)", () => {
    const result = fareRuleSchema.safeParse({
      ...validRule,
      from_zone_id: "not-a-uuid",
    })
    expect(result.success).toBe(false)
  })

  it("rejects invalid to_zone_id (not UUID)", () => {
    const result = fareRuleSchema.safeParse({
      ...validRule,
      to_zone_id: "not-a-uuid",
    })
    expect(result.success).toBe(false)
  })

  it("parses decimal base_price correctly", () => {
    const result = fareRuleSchema.safeParse({
      ...validRule,
      base_price: "12.75",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.base_price).toBe(12.75)
    }
  })
})
