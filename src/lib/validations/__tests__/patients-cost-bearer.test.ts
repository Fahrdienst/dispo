import { describe, it, expect } from "vitest"
import { patientSchema, patientInlineSchema } from "../patients"
import { COST_BEARER_VALUES, COST_BEARER_NONE } from "@/lib/patients/constants"

/**
 * Kostenträger (cost bearer) boundary validation (Issue #125, M13).
 *
 * The <Select> in the patient form submits either an enum value, an empty
 * string, or the "__none__" sentinel. All non-values must collapse to `null`
 * (cost bearer is optional and lives on the patient, never on the ride). The
 * enum whitelist must reject anything outside `COST_BEARER_VALUES`.
 *
 * Covered through both `patientSchema` (full form #134) and
 * `patientInlineSchema` (inline quick-create #137), since the cost-bearer field
 * is shared between them.
 */

const validPatientBase = {
  first_name: "Anna",
  last_name: "Muster",
  street: "Bahnhofstrasse",
  house_number: "1",
  postal_code: "8600",
  city: "Dübendorf",
}

describe("cost_bearer field (#125)", () => {
  describe("patientSchema (full form)", () => {
    it("maps an empty string to null", () => {
      const result = patientSchema.safeParse({
        ...validPatientBase,
        cost_bearer: "",
      })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.cost_bearer).toBeNull()
    })

    it("maps the __none__ sentinel to null", () => {
      const result = patientSchema.safeParse({
        ...validPatientBase,
        cost_bearer: COST_BEARER_NONE,
      })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.cost_bearer).toBeNull()
    })

    it("maps an omitted cost_bearer to null", () => {
      const result = patientSchema.safeParse(validPatientBase)
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.cost_bearer).toBeNull()
    })

    it.each(COST_BEARER_VALUES)(
      "accepts the whitelisted value %s",
      (value) => {
        const result = patientSchema.safeParse({
          ...validPatientBase,
          cost_bearer: value,
        })
        expect(result.success).toBe(true)
        if (result.success) expect(result.data.cost_bearer).toBe(value)
      }
    )

    it("rejects a value outside the enum", () => {
      const result = patientSchema.safeParse({
        ...validPatientBase,
        cost_bearer: "credit_card",
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(
          result.error.issues.some((i) => i.path.includes("cost_bearer"))
        ).toBe(true)
      }
    })
  })

  describe("patientInlineSchema (inline quick-create)", () => {
    it("maps the __none__ sentinel to null", () => {
      const result = patientInlineSchema.safeParse({
        ...validPatientBase,
        cost_bearer: COST_BEARER_NONE,
      })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.cost_bearer).toBeNull()
    })

    it("accepts a valid enum value", () => {
      const result = patientInlineSchema.safeParse({
        ...validPatientBase,
        cost_bearer: "municipality",
      })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.cost_bearer).toBe("municipality")
    })

    it("rejects a value outside the enum", () => {
      const result = patientInlineSchema.safeParse({
        ...validPatientBase,
        cost_bearer: "cash",
      })
      expect(result.success).toBe(false)
    })
  })

  it("exposes exactly the four documented cost-bearer values", () => {
    expect([...COST_BEARER_VALUES]).toEqual([
      "health_insurance",
      "self_payer",
      "municipality",
      "other",
    ])
  })
})
