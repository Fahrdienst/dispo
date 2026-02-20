import { describe, it, expect } from "vitest"
import {
  rideSchema,
  addMinutesToTime,
  DEFAULT_RETURN_BUFFER_MINUTES,
} from "../rides"

const validRide = {
  patient_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  destination_id: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
  driver_id: "",
  date: "2026-03-15",
  pickup_time: "08:30",
  direction: "outbound" as const,
  notes: "",
}

describe("rideSchema", () => {
  it("accepts valid input", () => {
    const result = rideSchema.safeParse(validRide)
    expect(result.success).toBe(true)
  })

  // --- Required fields ---

  it("rejects missing patient_id", () => {
    const result = rideSchema.safeParse({ ...validRide, patient_id: "" })
    expect(result.success).toBe(false)
  })

  it("rejects non-uuid patient_id", () => {
    const result = rideSchema.safeParse({
      ...validRide,
      patient_id: "not-a-uuid",
    })
    expect(result.success).toBe(false)
  })

  it("rejects missing destination_id", () => {
    const result = rideSchema.safeParse({ ...validRide, destination_id: "" })
    expect(result.success).toBe(false)
  })

  it("rejects empty date", () => {
    const result = rideSchema.safeParse({ ...validRide, date: "" })
    expect(result.success).toBe(false)
  })

  it("rejects empty pickup_time", () => {
    const result = rideSchema.safeParse({ ...validRide, pickup_time: "" })
    expect(result.success).toBe(false)
  })

  // --- Empty-to-null transforms ---

  it("transforms empty driver_id to null", () => {
    const result = rideSchema.safeParse({ ...validRide, driver_id: "" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.driver_id).toBeNull()
    }
  })

  it("transforms empty notes to null", () => {
    const result = rideSchema.safeParse({ ...validRide, notes: "" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.notes).toBeNull()
    }
  })

  it("preserves valid driver_id", () => {
    const driverId = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33"
    const result = rideSchema.safeParse({ ...validRide, driver_id: driverId })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.driver_id).toBe(driverId)
    }
  })

  // --- Max length ---

  it("rejects notes over 1000 chars", () => {
    const result = rideSchema.safeParse({
      ...validRide,
      notes: "A".repeat(1001),
    })
    expect(result.success).toBe(false)
  })

  // --- Direction enum ---

  it("accepts all valid direction values", () => {
    for (const direction of ["outbound", "return", "both"] as const) {
      const result = rideSchema.safeParse({ ...validRide, direction })
      expect(result.success).toBe(true)
    }
  })

  it("rejects invalid direction", () => {
    const result = rideSchema.safeParse({
      ...validRide,
      direction: "sideways",
    })
    expect(result.success).toBe(false)
  })

  it("defaults direction to outbound when omitted", () => {
    const { direction: _, ...withoutDirection } = validRide
    const result = rideSchema.safeParse(withoutDirection)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.direction).toBe("outbound")
    }
  })

  // --- New appointment time fields (ADR-008) ---

  it("transforms empty appointment_time to null", () => {
    const result = rideSchema.safeParse({
      ...validRide,
      appointment_time: "",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.appointment_time).toBeNull()
    }
  })

  it("transforms empty appointment_end_time to null", () => {
    const result = rideSchema.safeParse({
      ...validRide,
      appointment_end_time: "",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.appointment_end_time).toBeNull()
    }
  })

  it("transforms empty return_pickup_time to null", () => {
    const result = rideSchema.safeParse({
      ...validRide,
      return_pickup_time: "",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.return_pickup_time).toBeNull()
    }
  })

  it("preserves valid appointment times", () => {
    const result = rideSchema.safeParse({
      ...validRide,
      appointment_time: "09:00",
      appointment_end_time: "10:00",
      return_pickup_time: "10:15",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.appointment_time).toBe("09:00")
      expect(result.data.appointment_end_time).toBe("10:00")
      expect(result.data.return_pickup_time).toBe("10:15")
    }
  })

  it("accepts ride without any appointment times", () => {
    const result = rideSchema.safeParse(validRide)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.appointment_time).toBeUndefined()
      expect(result.data.appointment_end_time).toBeUndefined()
      expect(result.data.return_pickup_time).toBeUndefined()
    }
  })

  // --- Time order validation ---

  it("rejects appointment_time before pickup_time", () => {
    const result = rideSchema.safeParse({
      ...validRide,
      pickup_time: "09:00",
      appointment_time: "08:30",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issues = result.error.issues
      expect(issues.some((i) => i.path.includes("appointment_time"))).toBe(
        true
      )
    }
  })

  it("rejects appointment_time equal to pickup_time", () => {
    const result = rideSchema.safeParse({
      ...validRide,
      pickup_time: "09:00",
      appointment_time: "09:00",
    })
    expect(result.success).toBe(false)
  })

  it("accepts appointment_time after pickup_time", () => {
    const result = rideSchema.safeParse({
      ...validRide,
      pickup_time: "08:30",
      appointment_time: "09:00",
    })
    expect(result.success).toBe(true)
  })

  it("rejects appointment_end_time before appointment_time", () => {
    const result = rideSchema.safeParse({
      ...validRide,
      appointment_time: "09:00",
      appointment_end_time: "08:30",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issues = result.error.issues
      expect(
        issues.some((i) => i.path.includes("appointment_end_time"))
      ).toBe(true)
    }
  })

  it("rejects appointment_end_time equal to appointment_time", () => {
    const result = rideSchema.safeParse({
      ...validRide,
      appointment_time: "09:00",
      appointment_end_time: "09:00",
    })
    expect(result.success).toBe(false)
  })

  it("accepts appointment_end_time after appointment_time", () => {
    const result = rideSchema.safeParse({
      ...validRide,
      appointment_time: "09:00",
      appointment_end_time: "10:00",
    })
    expect(result.success).toBe(true)
  })

  it("rejects return_pickup_time before appointment_end_time", () => {
    const result = rideSchema.safeParse({
      ...validRide,
      appointment_time: "09:00",
      appointment_end_time: "10:00",
      return_pickup_time: "09:45",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issues = result.error.issues
      expect(issues.some((i) => i.path.includes("return_pickup_time"))).toBe(
        true
      )
    }
  })

  it("accepts return_pickup_time equal to appointment_end_time", () => {
    const result = rideSchema.safeParse({
      ...validRide,
      appointment_time: "09:00",
      appointment_end_time: "10:00",
      return_pickup_time: "10:00",
    })
    expect(result.success).toBe(true)
  })

  it("accepts return_pickup_time after appointment_end_time", () => {
    const result = rideSchema.safeParse({
      ...validRide,
      appointment_time: "09:00",
      appointment_end_time: "10:00",
      return_pickup_time: "10:15",
    })
    expect(result.success).toBe(true)
  })

  // --- create_return_ride validation ---

  it("defaults create_return_ride to false when not provided", () => {
    const result = rideSchema.safeParse(validRide)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.create_return_ride).toBe(false)
    }
  })

  it("transforms create_return_ride 'on' to true", () => {
    const result = rideSchema.safeParse({
      ...validRide,
      appointment_time: "09:00",
      appointment_end_time: "10:00",
      create_return_ride: "on",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.create_return_ride).toBe(true)
    }
  })

  it("transforms create_return_ride 'true' to true", () => {
    const result = rideSchema.safeParse({
      ...validRide,
      appointment_time: "09:00",
      appointment_end_time: "10:00",
      create_return_ride: "true",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.create_return_ride).toBe(true)
    }
  })

  it("rejects create_return_ride without appointment_end_time", () => {
    const result = rideSchema.safeParse({
      ...validRide,
      create_return_ride: "on",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issues = result.error.issues
      expect(
        issues.some((i) => i.path.includes("appointment_end_time"))
      ).toBe(true)
    }
  })

  it("rejects create_return_ride with empty appointment_end_time", () => {
    const result = rideSchema.safeParse({
      ...validRide,
      appointment_end_time: "",
      create_return_ride: "on",
    })
    expect(result.success).toBe(false)
  })

  it("accepts create_return_ride with appointment_end_time set", () => {
    const result = rideSchema.safeParse({
      ...validRide,
      appointment_time: "09:00",
      appointment_end_time: "10:00",
      create_return_ride: "on",
    })
    expect(result.success).toBe(true)
  })
})

// --- addMinutesToTime helper ---

describe("addMinutesToTime", () => {
  it("adds minutes correctly", () => {
    expect(addMinutesToTime("09:00", 15)).toBe("09:15")
  })

  it("handles hour rollover", () => {
    expect(addMinutesToTime("09:50", 15)).toBe("10:05")
  })

  it("handles large additions", () => {
    expect(addMinutesToTime("08:00", 120)).toBe("10:00")
  })

  it("returns null when result exceeds 23:59", () => {
    expect(addMinutesToTime("23:50", 15)).toBeNull()
  })

  it("handles midnight boundary", () => {
    expect(addMinutesToTime("23:45", 14)).toBe("23:59")
    expect(addMinutesToTime("23:45", 15)).toBeNull()
  })

  it("returns null for invalid input", () => {
    expect(addMinutesToTime("invalid", 10)).toBeNull()
  })

  it("handles zero minutes", () => {
    expect(addMinutesToTime("14:30", 0)).toBe("14:30")
  })

  it("pads single-digit hours and minutes", () => {
    expect(addMinutesToTime("01:05", 3)).toBe("01:08")
  })
})

// --- DEFAULT_RETURN_BUFFER_MINUTES ---

describe("DEFAULT_RETURN_BUFFER_MINUTES", () => {
  it("is 15", () => {
    expect(DEFAULT_RETURN_BUFFER_MINUTES).toBe(15)
  })
})
