import { describe, expect, it, vi, beforeEach } from "vitest"
import { isShortNotice, getSLAWindows } from "../engine"
import {
  NORMAL_SLA_WINDOWS,
  SHORT_NOTICE_SLA_WINDOWS,
  SHORT_NOTICE_THRESHOLD_MINUTES,
} from "../constants"

describe("isShortNotice", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it("returns true when pickup is less than 60 minutes away", () => {
    // Set "now" to 30 min before pickup (local time)
    const pickup = new Date("2026-03-05T10:30:00")
    vi.setSystemTime(new Date(pickup.getTime() - 30 * 60 * 1000))

    expect(isShortNotice("2026-03-05", "10:30:00")).toBe(true)
  })

  it("returns false when pickup is more than 60 minutes away", () => {
    // Set "now" to 2 hours before pickup
    const pickup = new Date("2026-03-05T10:00:00")
    vi.setSystemTime(new Date(pickup.getTime() - 120 * 60 * 1000))

    expect(isShortNotice("2026-03-05", "10:00:00")).toBe(false)
  })

  it("returns false when pickup is exactly at the threshold (60 min away)", () => {
    // Use a time that ensures exactly 60 minutes difference
    // isShortNotice uses `new Date(date + 'T' + time)` which is local time
    const pickup = new Date("2026-03-05T10:00:00")
    const now = new Date(pickup.getTime() - SHORT_NOTICE_THRESHOLD_MINUTES * 60 * 1000)
    vi.setSystemTime(now)

    // Exactly 60 minutes away → diffMinutes = 60 → NOT < 60 → false
    expect(isShortNotice("2026-03-05", "10:00:00")).toBe(false)
  })

  it("returns true when pickup is 59 minutes away", () => {
    const pickup = new Date("2026-03-05T10:00:00")
    vi.setSystemTime(new Date(pickup.getTime() - 59 * 60 * 1000))

    expect(isShortNotice("2026-03-05", "10:00:00")).toBe(true)
  })

  it("returns true when pickup is in the past", () => {
    const pickup = new Date("2026-03-05T10:00:00")
    vi.setSystemTime(new Date(pickup.getTime() + 120 * 60 * 1000))

    expect(isShortNotice("2026-03-05", "10:00:00")).toBe(true)
  })

  it("returns false for a next-day pickup", () => {
    const pickup = new Date("2026-03-05T10:00:00")
    vi.setSystemTime(pickup)

    // Tomorrow's pickup is 24 hours away
    expect(isShortNotice("2026-03-06", "10:00:00")).toBe(false)
  })
})

describe("getSLAWindows", () => {
  it("returns normal windows when not short notice", () => {
    const windows = getSLAWindows(false)
    expect(windows).toEqual(NORMAL_SLA_WINDOWS)
  })

  it("returns short-notice windows when short notice", () => {
    const windows = getSLAWindows(true)
    expect(windows).toEqual(SHORT_NOTICE_SLA_WINDOWS)
  })
})

describe("escalation flow", () => {
  it("normal flow stages: notified → reminder_1 → reminder_2 → timed_out", () => {
    // This test documents the expected escalation chain
    const stages = ["notified", "reminder_1", "reminder_2", "timed_out"] as const
    const windows = NORMAL_SLA_WINDOWS

    // Stage transitions happen at: 10min, 25min, 40min
    expect(windows.reminder1).toBe(10)
    expect(windows.reminder2).toBe(25)
    expect(windows.timeout).toBe(40)

    // Each stage leads to the next
    expect(stages[0]).toBe("notified")
    expect(stages[1]).toBe("reminder_1")
    expect(stages[2]).toBe("reminder_2")
    expect(stages[3]).toBe("timed_out")
  })

  it("short-notice flow uses compressed windows", () => {
    const windows = SHORT_NOTICE_SLA_WINDOWS

    // Compressed: 3min, 8min, 15min
    expect(windows.reminder1).toBe(3)
    expect(windows.reminder2).toBe(8)
    expect(windows.timeout).toBe(15)

    // Total time from notification to timeout
    expect(windows.timeout).toBeLessThan(SHORT_NOTICE_THRESHOLD_MINUTES)
  })
})
