import { describe, it, expect } from "vitest"
import {
  resolveAvailability,
  weekdayOf,
  toAvailabilityEntries,
  type AvailabilityEntry,
  type Weekday,
} from "@/lib/availability/resolve"

// Fixed reference dates (UTC-stable):
//   2026-07-13 is a Monday
//   2026-07-18 is a Saturday
//   2026-07-19 is a Sunday
const MONDAY = "2026-07-13"
const TUESDAY = "2026-07-14"
const SATURDAY = "2026-07-18"
const SUNDAY = "2026-07-19"

function weekly(dayOfWeek: Weekday, start: string, end: string): AvailabilityEntry {
  return { kind: "weekly", dayOfWeek, start, end }
}

function exception(
  date: string,
  start: string | null,
  end: string | null
): AvailabilityEntry {
  return { kind: "exception", date, start, end }
}

describe("weekdayOf", () => {
  it("computes the weekday name in UTC", () => {
    expect(weekdayOf(MONDAY)).toBe("monday")
    expect(weekdayOf(TUESDAY)).toBe("tuesday")
    expect(weekdayOf(SATURDAY)).toBe("saturday")
    expect(weekdayOf(SUNDAY)).toBe("sunday")
  })

  it("rejects malformed dates", () => {
    expect(() => weekdayOf("2026-7-1")).toThrow()
    expect(() => weekdayOf("not-a-date")).toThrow()
  })
})

describe("resolveAvailability - weekly grid", () => {
  it("returns [] when there are no entries at all", () => {
    expect(resolveAvailability(MONDAY, [])).toEqual([])
  })

  it("returns the weekly window matching the weekday", () => {
    const entries: AvailabilityEntry[] = [
      weekly("monday", "08:00", "10:00"),
      weekly("tuesday", "14:00", "16:00"),
    ]
    expect(resolveAvailability(MONDAY, entries)).toEqual([
      { start: "08:00", end: "10:00" },
    ])
  })

  it("returns [] for a weekday that has no weekly entries", () => {
    const entries: AvailabilityEntry[] = [weekly("monday", "08:00", "10:00")]
    expect(resolveAvailability(TUESDAY, entries)).toEqual([])
  })

  it("accepts HH:MM:SS times (as stored by Postgres) and normalizes to HH:MM", () => {
    const entries: AvailabilityEntry[] = [
      weekly("monday", "08:00:00", "10:00:00"),
    ]
    expect(resolveAvailability(MONDAY, entries)).toEqual([
      { start: "08:00", end: "10:00" },
    ])
  })

  it("merges adjacent fixed slots into one contiguous window", () => {
    const entries: AvailabilityEntry[] = [
      weekly("monday", "08:00", "10:00"),
      weekly("monday", "10:00", "12:00"),
      weekly("monday", "12:00", "14:00"),
    ]
    expect(resolveAvailability(MONDAY, entries)).toEqual([
      { start: "08:00", end: "14:00" },
    ])
  })

  it("keeps non-adjacent windows separate and sorted", () => {
    const entries: AvailabilityEntry[] = [
      weekly("monday", "14:00", "16:00"),
      weekly("monday", "08:00", "10:00"),
    ]
    expect(resolveAvailability(MONDAY, entries)).toEqual([
      { start: "08:00", end: "10:00" },
      { start: "14:00", end: "16:00" },
    ])
  })

  it("merges overlapping windows", () => {
    const entries: AvailabilityEntry[] = [
      weekly("monday", "08:00", "12:00"),
      weekly("monday", "10:00", "14:00"),
    ]
    expect(resolveAvailability(MONDAY, entries)).toEqual([
      { start: "08:00", end: "14:00" },
    ])
  })

  it("supports weekend weekly entries (generic beyond the Mo-Fr UI constraint)", () => {
    const entries: AvailabilityEntry[] = [weekly("saturday", "10:00", "12:00")]
    expect(resolveAvailability(SATURDAY, entries)).toEqual([
      { start: "10:00", end: "12:00" },
    ])
  })
})

describe("resolveAvailability - date-specific exceptions (precedence)", () => {
  it("an exception fully overrides the weekly grid for that date", () => {
    const entries: AvailabilityEntry[] = [
      weekly("monday", "08:00", "12:00"),
      exception(MONDAY, "14:00", "16:00"),
    ]
    expect(resolveAvailability(MONDAY, entries)).toEqual([
      { start: "14:00", end: "16:00" },
    ])
  })

  it("an empty exception marks the day as not available, ignoring the grid", () => {
    const entries: AvailabilityEntry[] = [
      weekly("monday", "08:00", "12:00"),
      exception(MONDAY, null, null),
    ]
    expect(resolveAvailability(MONDAY, entries)).toEqual([])
  })

  it("does not leak an exception onto other dates (grid still applies)", () => {
    const nextMonday = "2026-07-20"
    const entries: AvailabilityEntry[] = [
      weekly("monday", "08:00", "12:00"),
      exception(MONDAY, null, null),
    ]
    // The exception is only for MONDAY 2026-07-13; the following Monday uses the grid.
    expect(resolveAvailability(nextMonday, entries)).toEqual([
      { start: "08:00", end: "12:00" },
    ])
  })

  it("merges multiple exception windows for the same date", () => {
    const entries: AvailabilityEntry[] = [
      exception(MONDAY, "08:00", "10:00"),
      exception(MONDAY, "10:00", "12:00"),
      exception(MONDAY, "16:00", "18:00"),
    ]
    expect(resolveAvailability(MONDAY, entries)).toEqual([
      { start: "08:00", end: "12:00" },
      { start: "16:00", end: "18:00" },
    ])
  })

  it("if any exception marker exists, other concrete exception windows for that date still count", () => {
    // A marker plus a concrete window is contradictory input; concrete windows win.
    const entries: AvailabilityEntry[] = [
      exception(MONDAY, null, null),
      exception(MONDAY, "10:00", "12:00"),
    ]
    expect(resolveAvailability(MONDAY, entries)).toEqual([
      { start: "10:00", end: "12:00" },
    ])
  })

  it("provides availability on a day with no weekly grid via an exception", () => {
    const entries: AvailabilityEntry[] = [exception(SUNDAY, "10:00", "12:00")]
    expect(resolveAvailability(SUNDAY, entries)).toEqual([
      { start: "10:00", end: "12:00" },
    ])
  })

  it("only considers exceptions for the queried date when several dates have exceptions", () => {
    const entries: AvailabilityEntry[] = [
      exception(MONDAY, "08:00", "10:00"),
      exception(TUESDAY, "14:00", "16:00"),
    ]
    expect(resolveAvailability(TUESDAY, entries)).toEqual([
      { start: "14:00", end: "16:00" },
    ])
  })
})

describe("toAvailabilityEntries", () => {
  it("splits Supabase rows into weekly and exception entries and skips empty rows", () => {
    const rows = [
      {
        day_of_week: "monday" as const,
        specific_date: null,
        start_time: "08:00:00",
        end_time: "10:00:00",
      },
      {
        day_of_week: null,
        specific_date: "2026-07-13",
        start_time: "14:00:00",
        end_time: "16:00:00",
      },
      // Degenerate row (neither set) — should be ignored.
      {
        day_of_week: null,
        specific_date: null,
        start_time: "08:00:00",
        end_time: "10:00:00",
      },
    ]
    expect(toAvailabilityEntries(rows)).toEqual([
      { kind: "weekly", dayOfWeek: "monday", start: "08:00:00", end: "10:00:00" },
      { kind: "exception", date: "2026-07-13", start: "14:00:00", end: "16:00:00" },
    ])
  })

  it("round-trips through resolveAvailability", () => {
    const rows = [
      {
        day_of_week: "monday" as const,
        specific_date: null,
        start_time: "08:00:00",
        end_time: "10:00:00",
      },
    ]
    const entries = toAvailabilityEntries(rows)
    expect(resolveAvailability(MONDAY, entries)).toEqual([
      { start: "08:00", end: "10:00" },
    ])
  })
})
