import { describe, it, expect } from "vitest"
import {
  rideRequirementSchema,
  rideRequirementsSchema,
} from "../rides"
import { RIDE_REQUIREMENTS } from "@/lib/rides/requirements"

/**
 * Bedarf (ride requirements) boundary schemas (Issue #126, M13).
 *
 * `src/lib/validations/__tests__/rides.test.ts` exercises requirements through
 * the full `rideSchema`. This file covers the two exported building blocks
 * directly — the single-value enum and the set schema with its empty-array
 * default — because they are the runtime whitelist that keeps the
 * `ride_requirement[]` column well-defined even for rides created outside the
 * capture UI (#135).
 */

describe("rideRequirementSchema (single value)", () => {
  it.each(RIDE_REQUIREMENTS)("accepts the whitelisted value %s", (value) => {
    expect(rideRequirementSchema.safeParse(value).success).toBe(true)
  })

  it("rejects a value outside the enum", () => {
    expect(rideRequirementSchema.safeParse("teleport").success).toBe(false)
  })

  it("rejects a non-string value", () => {
    expect(rideRequirementSchema.safeParse(42).success).toBe(false)
  })
})

describe("rideRequirementsSchema (set)", () => {
  it("defaults to an empty array when the value is omitted", () => {
    const result = rideRequirementsSchema.safeParse(undefined)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toEqual([])
  })

  it("accepts an empty array", () => {
    const result = rideRequirementsSchema.safeParse([])
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toEqual([])
  })

  it("accepts the full requirement set", () => {
    const result = rideRequirementsSchema.safeParse([...RIDE_REQUIREMENTS])
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toEqual([...RIDE_REQUIREMENTS])
  })

  it("preserves order and duplicates (dedup is a downstream concern)", () => {
    const result = rideRequirementsSchema.safeParse([
      "wheelchair",
      "wheelchair",
      "oxygen",
    ])
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual(["wheelchair", "wheelchair", "oxygen"])
    }
  })

  it("rejects the whole set if a single member is invalid", () => {
    const result = rideRequirementsSchema.safeParse(["wheelchair", "unicorn"])
    expect(result.success).toBe(false)
  })
})
