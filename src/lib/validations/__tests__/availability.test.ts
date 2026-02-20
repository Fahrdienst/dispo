import { describe, it, expect } from "vitest"
import { weeklyAvailabilitySchema, dateSpecificAvailabilitySchema } from "../availability"

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000"

function makeInput(
  overrides: Partial<{ driver_id: string; slots: { day_of_week: string; start_time: string }[] }> = {}
) {
  return {
    driver_id: VALID_UUID,
    slots: [],
    ...overrides,
  }
}

describe("weeklyAvailabilitySchema", () => {
  // --- Basic acceptance ---

  it("accepts empty slots array", () => {
    const result = weeklyAvailabilitySchema.safeParse(makeInput())
    expect(result.success).toBe(true)
  })

  it("accepts a valid single slot", () => {
    const result = weeklyAvailabilitySchema.safeParse(
      makeInput({ slots: [{ day_of_week: "monday", start_time: "08:00" }] })
    )
    expect(result.success).toBe(true)
  })

  it("accepts full grid (25 slots)", () => {
    const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const
    const times = ["08:00", "10:00", "12:00", "14:00", "16:00"] as const
    const slots: { day_of_week: string; start_time: string }[] = []
    for (const day of weekdays) {
      for (const time of times) {
        slots.push({ day_of_week: day, start_time: time })
      }
    }
    const result = weeklyAvailabilitySchema.safeParse(makeInput({ slots }))
    expect(result.success).toBe(true)
  })

  // --- Valid start times ---

  it("accepts all valid start times", () => {
    for (const time of ["08:00", "10:00", "12:00", "14:00", "16:00"]) {
      const result = weeklyAvailabilitySchema.safeParse(
        makeInput({ slots: [{ day_of_week: "monday", start_time: time }] })
      )
      expect(result.success).toBe(true)
    }
  })

  // --- Valid weekdays ---

  it("accepts all valid weekdays", () => {
    for (const day of ["monday", "tuesday", "wednesday", "thursday", "friday"]) {
      const result = weeklyAvailabilitySchema.safeParse(
        makeInput({ slots: [{ day_of_week: day, start_time: "08:00" }] })
      )
      expect(result.success).toBe(true)
    }
  })

  // --- Invalid start times ---

  it("rejects invalid start time 09:00", () => {
    const result = weeklyAvailabilitySchema.safeParse(
      makeInput({ slots: [{ day_of_week: "monday", start_time: "09:00" }] })
    )
    expect(result.success).toBe(false)
  })

  it("rejects invalid start time 07:00", () => {
    const result = weeklyAvailabilitySchema.safeParse(
      makeInput({ slots: [{ day_of_week: "monday", start_time: "07:00" }] })
    )
    expect(result.success).toBe(false)
  })

  // --- Weekend rejected ---

  it("rejects saturday", () => {
    const result = weeklyAvailabilitySchema.safeParse(
      makeInput({ slots: [{ day_of_week: "saturday", start_time: "08:00" }] })
    )
    expect(result.success).toBe(false)
  })

  it("rejects sunday", () => {
    const result = weeklyAvailabilitySchema.safeParse(
      makeInput({ slots: [{ day_of_week: "sunday", start_time: "08:00" }] })
    )
    expect(result.success).toBe(false)
  })

  // --- Duplicate slots ---

  it("rejects duplicate slots", () => {
    const result = weeklyAvailabilitySchema.safeParse(
      makeInput({
        slots: [
          { day_of_week: "monday", start_time: "08:00" },
          { day_of_week: "monday", start_time: "08:00" },
        ],
      })
    )
    expect(result.success).toBe(false)
  })

  // --- Invalid UUID ---

  it("rejects invalid driver_id UUID", () => {
    const result = weeklyAvailabilitySchema.safeParse(
      makeInput({ driver_id: "not-a-uuid" })
    )
    expect(result.success).toBe(false)
  })

  // --- More than 25 slots ---

  it("rejects more than 25 slots", () => {
    const slots: { day_of_week: string; start_time: string }[] = []
    const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const
    const times = ["08:00", "10:00", "12:00", "14:00", "16:00"] as const
    for (const day of weekdays) {
      for (const time of times) {
        slots.push({ day_of_week: day, start_time: time })
      }
    }
    // Add one more (duplicate day but we need 26 unique -- use a trick with non-matching but valid entries)
    // Since we already have 25 and max is 25, adding any more should fail
    slots.push({ day_of_week: "monday", start_time: "08:00" })
    const result = weeklyAvailabilitySchema.safeParse(makeInput({ slots }))
    expect(result.success).toBe(false)
  })
})

// --- dateSpecificAvailabilitySchema ---

function makeDateInput(
  overrides: Partial<{ driver_id: string; specific_date: string; slots: string[] }> = {}
) {
  return {
    driver_id: VALID_UUID,
    specific_date: "2026-03-15",
    slots: [],
    ...overrides,
  }
}

describe("dateSpecificAvailabilitySchema", () => {
  // --- Basic acceptance ---

  it("accepts empty slots array", () => {
    const result = dateSpecificAvailabilitySchema.safeParse(makeDateInput())
    expect(result.success).toBe(true)
  })

  it("accepts a valid single slot", () => {
    const result = dateSpecificAvailabilitySchema.safeParse(
      makeDateInput({ slots: ["08:00"] })
    )
    expect(result.success).toBe(true)
  })

  it("accepts all 5 slots", () => {
    const result = dateSpecificAvailabilitySchema.safeParse(
      makeDateInput({ slots: ["08:00", "10:00", "12:00", "14:00", "16:00"] })
    )
    expect(result.success).toBe(true)
  })

  // --- Valid dates ---

  it("accepts valid date format YYYY-MM-DD", () => {
    const result = dateSpecificAvailabilitySchema.safeParse(
      makeDateInput({ specific_date: "2026-12-31" })
    )
    expect(result.success).toBe(true)
  })

  // --- Invalid dates ---

  it("rejects invalid date format DD.MM.YYYY", () => {
    const result = dateSpecificAvailabilitySchema.safeParse(
      makeDateInput({ specific_date: "15.03.2026" })
    )
    expect(result.success).toBe(false)
  })

  it("rejects invalid date format MM/DD/YYYY", () => {
    const result = dateSpecificAvailabilitySchema.safeParse(
      makeDateInput({ specific_date: "03/15/2026" })
    )
    expect(result.success).toBe(false)
  })

  it("rejects empty string as date", () => {
    const result = dateSpecificAvailabilitySchema.safeParse(
      makeDateInput({ specific_date: "" })
    )
    expect(result.success).toBe(false)
  })

  // --- Invalid slots ---

  it("rejects invalid start time 09:00", () => {
    const result = dateSpecificAvailabilitySchema.safeParse(
      makeDateInput({ slots: ["09:00"] })
    )
    expect(result.success).toBe(false)
  })

  it("rejects invalid start time 07:00", () => {
    const result = dateSpecificAvailabilitySchema.safeParse(
      makeDateInput({ slots: ["07:00"] })
    )
    expect(result.success).toBe(false)
  })

  // --- Max 5 slots ---

  it("rejects more than 5 slots", () => {
    const result = dateSpecificAvailabilitySchema.safeParse(
      makeDateInput({ slots: ["08:00", "10:00", "12:00", "14:00", "16:00", "08:00"] })
    )
    expect(result.success).toBe(false)
  })

  // --- Duplicate slots ---

  it("rejects duplicate slots", () => {
    const result = dateSpecificAvailabilitySchema.safeParse(
      makeDateInput({ slots: ["08:00", "08:00"] })
    )
    expect(result.success).toBe(false)
  })

  // --- Invalid UUID ---

  it("rejects invalid driver_id UUID", () => {
    const result = dateSpecificAvailabilitySchema.safeParse(
      makeDateInput({ driver_id: "not-a-uuid" })
    )
    expect(result.success).toBe(false)
  })
})
