import { describe, it, expect } from "vitest"
import {
  requirementsToVehicleType,
  RIDE_REQUIREMENTS,
  type RideRequirement,
} from "@/lib/rides/requirements"

describe("requirementsToVehicleType", () => {
  it("maps an empty requirement set to standard", () => {
    expect(requirementsToVehicleType([])).toBe("standard")
  })

  it("maps a wheelchair requirement to the wheelchair vehicle", () => {
    expect(requirementsToVehicleType(["wheelchair"])).toBe("wheelchair")
  })

  it("returns wheelchair when wheelchair is present alongside other requirements", () => {
    expect(
      requirementsToVehicleType(["oxygen", "wheelchair", "companion"])
    ).toBe("wheelchair")
  })

  it("is order-independent for wheelchair detection", () => {
    expect(requirementsToVehicleType(["wheelchair", "rollator"])).toBe(
      "wheelchair"
    )
    expect(requirementsToVehicleType(["rollator", "wheelchair"])).toBe(
      "wheelchair"
    )
  })

  it("is unaffected by duplicate wheelchair entries", () => {
    expect(requirementsToVehicleType(["wheelchair", "wheelchair"])).toBe(
      "wheelchair"
    )
  })

  // Informative-only flags must NOT introduce a non-standard vehicle type.
  const informativeOnly: RideRequirement[] = [
    "rollator",
    "companion",
    "oxygen",
    "carry_chair",
    "stretcher",
  ]

  it.each(informativeOnly)(
    "maps the informative-only requirement %s to standard",
    (requirement) => {
      expect(requirementsToVehicleType([requirement])).toBe("standard")
    }
  )

  it("maps a combination of only informative flags to standard", () => {
    expect(
      requirementsToVehicleType(["oxygen", "carry_chair", "stretcher"])
    ).toBe("standard")
  })

  it("only ever resolves to existing vehicle_type values (no enum extension)", () => {
    const allowed = new Set(["standard", "wheelchair"])
    // Every single requirement, and the full set, must resolve to an allowed
    // vehicle type -- guards against accidentally returning a new enum value.
    for (const requirement of RIDE_REQUIREMENTS) {
      expect(allowed.has(requirementsToVehicleType([requirement]))).toBe(true)
    }
    expect(allowed.has(requirementsToVehicleType([...RIDE_REQUIREMENTS]))).toBe(
      true
    )
  })
})
