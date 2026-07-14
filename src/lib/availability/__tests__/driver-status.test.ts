import { describe, it, expect } from "vitest"
import {
  findAbsenceOn,
  isTimeWithinWindows,
  resolveDriverDayStatus,
  type AvailabilityRow,
  type AbsenceRange,
} from "@/lib/availability/driver-status"

// 2026-07-13 is a Monday, 2026-07-14 a Tuesday.
const MONDAY = "2026-07-13"
const TUESDAY = "2026-07-14"

const mondayEightToTen: AvailabilityRow = {
  day_of_week: "monday",
  specific_date: null,
  start_time: "08:00",
  end_time: "10:00",
}

const vacation: AbsenceRange = {
  start_date: "2026-07-13",
  end_date: "2026-07-17",
  type: "vacation",
}

describe("findAbsenceOn", () => {
  it("matches a date inside the inclusive range", () => {
    expect(findAbsenceOn(MONDAY, [vacation])).toEqual(vacation)
    expect(findAbsenceOn("2026-07-17", [vacation])).toEqual(vacation)
  })

  it("returns null outside the range or for malformed dates", () => {
    expect(findAbsenceOn("2026-07-18", [vacation])).toBeNull()
    expect(findAbsenceOn("2026-7-1", [vacation])).toBeNull()
  })
})

describe("isTimeWithinWindows", () => {
  const windows = [{ start: "08:00", end: "10:00" }]

  it("is inclusive of start, exclusive of end", () => {
    expect(isTimeWithinWindows("08:00", windows)).toBe(true)
    expect(isTimeWithinWindows("09:30", windows)).toBe(true)
    expect(isTimeWithinWindows("10:00", windows)).toBe(false)
  })

  it("ignores seconds", () => {
    expect(isTimeWithinWindows("09:00:00", windows)).toBe(true)
  })
})

describe("resolveDriverDayStatus", () => {
  it("flags an approved absence and skips the window check", () => {
    const status = resolveDriverDayStatus(
      MONDAY,
      "08:30",
      [mondayEightToTen],
      [vacation]
    )
    expect(status.isAbsent).toBe(true)
    expect(status.absenceType).toBe("vacation")
  })

  it("reports within-availability for a matching weekly slot", () => {
    const status = resolveDriverDayStatus(MONDAY, "08:30", [mondayEightToTen], [])
    expect(status.isAbsent).toBe(false)
    expect(status.hasAvailability).toBe(true)
    expect(status.isWithinAvailability).toBe(true)
  })

  it("reports outside-availability when the pickup falls in no window", () => {
    const status = resolveDriverDayStatus(MONDAY, "11:00", [mondayEightToTen], [])
    expect(status.isWithinAvailability).toBe(false)
  })

  it("treats a day without any window as outside availability", () => {
    const status = resolveDriverDayStatus(TUESDAY, "08:30", [mondayEightToTen], [])
    expect(status.hasAvailability).toBe(false)
    expect(status.isWithinAvailability).toBe(false)
  })

  it("does not warn when no pickup time is supplied yet", () => {
    const status = resolveDriverDayStatus(MONDAY, null, [mondayEightToTen], [])
    expect(status.isWithinAvailability).toBe(true)
  })
})
