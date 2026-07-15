import { describe, it, expect } from "vitest"
import { updateOrganizationSchema } from "../organization"

/**
 * Time-buffer defaults on organization_settings (Issue #128, M13).
 *
 * These org-wide buffers seed the pickup-time suggestion in the capture page
 * (feeding `loadRideTimeBuffers` -> `calculateRideTimes`). The Zod schema is the
 * boundary that turns raw FormData strings into clamped integers, mirroring the
 * 0-120 CHECK constraint in the migration. Tested through the full
 * `updateOrganizationSchema` because `bufferMinutes` is a private factory.
 */

const validBase = {
  org_name: "Fahrdienst Test",
  primary_color: "#000000",
  secondary_color: "#0066FF",
  email_from_name: "Fahrdienst",
}

describe("updateOrganizationSchema — time buffers (#128)", () => {
  it("applies the legacy defaults when the buffer fields are omitted", () => {
    const result = updateOrganizationSchema.safeParse(validBase)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.default_pickup_buffer_minutes).toBe(5)
      expect(result.data.default_boarding_minutes).toBe(0)
      expect(result.data.default_return_buffer_minutes).toBe(15)
    }
  })

  it("coerces string FormData values to integers", () => {
    const result = updateOrganizationSchema.safeParse({
      ...validBase,
      default_pickup_buffer_minutes: "10",
      default_boarding_minutes: "8",
      default_return_buffer_minutes: "20",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.default_pickup_buffer_minutes).toBe(10)
      expect(result.data.default_boarding_minutes).toBe(8)
      expect(result.data.default_return_buffer_minutes).toBe(20)
    }
  })

  it("accepts the boundary values 0 and 120", () => {
    const result = updateOrganizationSchema.safeParse({
      ...validBase,
      default_pickup_buffer_minutes: "0",
      default_boarding_minutes: "120",
      default_return_buffer_minutes: "0",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.default_pickup_buffer_minutes).toBe(0)
      expect(result.data.default_boarding_minutes).toBe(120)
    }
  })

  it("rejects a negative buffer", () => {
    const result = updateOrganizationSchema.safeParse({
      ...validBase,
      default_pickup_buffer_minutes: "-1",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(
        result.error.issues.some((i) =>
          i.path.includes("default_pickup_buffer_minutes")
        )
      ).toBe(true)
    }
  })

  it("rejects a buffer above 120", () => {
    const result = updateOrganizationSchema.safeParse({
      ...validBase,
      default_return_buffer_minutes: "121",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(
        result.error.issues.some((i) =>
          i.path.includes("default_return_buffer_minutes")
        )
      ).toBe(true)
    }
  })

  it("rejects a non-integer buffer", () => {
    const result = updateOrganizationSchema.safeParse({
      ...validBase,
      default_boarding_minutes: "5.5",
    })
    expect(result.success).toBe(false)
  })

  it("rejects a non-numeric buffer string", () => {
    const result = updateOrganizationSchema.safeParse({
      ...validBase,
      default_pickup_buffer_minutes: "abc",
    })
    expect(result.success).toBe(false)
  })
})
