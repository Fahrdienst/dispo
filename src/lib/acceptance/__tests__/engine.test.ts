import { describe, expect, it, vi, afterEach, beforeEach } from "vitest"
import { isShortNotice, getSLAWindows, nextDeadline } from "../engine"
import {
  MINUTES_PER_HOUR,
  NORMAL_SLA_WINDOWS,
  SHORT_NOTICE_SLA_WINDOWS,
  SHORT_NOTICE_THRESHOLD_MINUTES,
} from "../constants"
import { zurichWallTimeToUtc } from "@/lib/utils/dates"

const MS_PER_HOUR = 60 * 60 * 1000

describe("isShortNotice (48h threshold, timezone-safe)", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  // Reference ride: 2026-03-05 (winter → CET, UTC+1). The helper resolves the
  // Zurich wall time to an absolute instant so the machine's own TZ is irrelevant.
  const RIDE_DATE = "2026-03-05"
  const RIDE_TIME = "10:00:00"
  const pickupMs = zurichWallTimeToUtc(RIDE_DATE, RIDE_TIME).getTime()

  it("is true when the ride starts less than 48h away", () => {
    vi.setSystemTime(new Date(pickupMs - 47 * MS_PER_HOUR))
    expect(isShortNotice(RIDE_DATE, RIDE_TIME)).toBe(true)
  })

  it("is false when the ride starts more than 48h away", () => {
    vi.setSystemTime(new Date(pickupMs - 49 * MS_PER_HOUR))
    expect(isShortNotice(RIDE_DATE, RIDE_TIME)).toBe(false)
  })

  it("is false exactly at the 48h threshold (not strictly less)", () => {
    vi.setSystemTime(new Date(pickupMs - SHORT_NOTICE_THRESHOLD_MINUTES * 60 * 1000))
    expect(isShortNotice(RIDE_DATE, RIDE_TIME)).toBe(false)
  })

  it("is true when the ride start is in the past", () => {
    vi.setSystemTime(new Date(pickupMs + 2 * MS_PER_HOUR))
    expect(isShortNotice(RIDE_DATE, RIDE_TIME)).toBe(true)
  })
})

describe("zurichWallTimeToUtc (DST handling)", () => {
  it("resolves a winter (CET, UTC+1) wall time correctly", () => {
    // 2026-03-05 10:00 Zurich == 09:00 UTC
    expect(zurichWallTimeToUtc("2026-03-05", "10:00:00").toISOString()).toBe(
      "2026-03-05T09:00:00.000Z"
    )
  })

  it("resolves a summer (CEST, UTC+2) wall time correctly", () => {
    // 2026-07-15 10:00 Zurich == 08:00 UTC
    expect(zurichWallTimeToUtc("2026-07-15", "10:00:00").toISOString()).toBe(
      "2026-07-15T08:00:00.000Z"
    )
  })
})

describe("getSLAWindows", () => {
  it("returns normal windows when not short notice", () => {
    expect(getSLAWindows(false)).toEqual(NORMAL_SLA_WINDOWS)
  })

  it("returns short-notice windows when short notice", () => {
    expect(getSLAWindows(true)).toEqual(SHORT_NOTICE_SLA_WINDOWS)
  })
})

describe("nextDeadline (single source for cron + UI)", () => {
  const NOTIFIED = "2026-03-05T08:00:00.000Z"
  const notifiedMs = new Date(NOTIFIED).getTime()

  it("points a normal 'notified' record at the 24h reminder", () => {
    const dl = nextDeadline({
      stage: "notified",
      is_short_notice: false,
      notified_at: NOTIFIED,
    })
    expect(dl?.nextStage).toBe("reminder_1")
    expect(dl?.dueAt.getTime()).toBe(notifiedMs + 24 * MINUTES_PER_HOUR * 60 * 1000)
  })

  it("points a normal 'reminder_1' record at the 48h timeout", () => {
    const dl = nextDeadline({
      stage: "reminder_1",
      is_short_notice: false,
      notified_at: NOTIFIED,
    })
    expect(dl?.nextStage).toBe("timed_out")
    expect(dl?.dueAt.getTime()).toBe(notifiedMs + 48 * MINUTES_PER_HOUR * 60 * 1000)
  })

  it("uses the compressed 4h/8h windows for short-notice records", () => {
    const reminder = nextDeadline({
      stage: "notified",
      is_short_notice: true,
      notified_at: NOTIFIED,
    })
    expect(reminder?.nextStage).toBe("reminder_1")
    expect(reminder?.dueAt.getTime()).toBe(notifiedMs + 4 * MINUTES_PER_HOUR * 60 * 1000)

    const timeout = nextDeadline({
      stage: "reminder_1",
      is_short_notice: true,
      notified_at: NOTIFIED,
    })
    expect(timeout?.nextStage).toBe("timed_out")
    expect(timeout?.dueAt.getTime()).toBe(notifiedMs + 8 * MINUTES_PER_HOUR * 60 * 1000)
  })

  it("escalates legacy 'reminder_2' records straight to timeout", () => {
    const dl = nextDeadline({
      stage: "reminder_2",
      is_short_notice: false,
      notified_at: NOTIFIED,
    })
    expect(dl?.nextStage).toBe("timed_out")
    expect(dl?.dueAt.getTime()).toBe(notifiedMs + 48 * MINUTES_PER_HOUR * 60 * 1000)
  })

  it("returns null for terminal stages", () => {
    for (const stage of ["timed_out", "confirmed", "rejected", "cancelled"] as const) {
      expect(
        nextDeadline({ stage, is_short_notice: false, notified_at: NOTIFIED })
      ).toBeNull()
    }
  })

  it("is a pure function — repeated calls yield identical deadlines", () => {
    const input = {
      stage: "notified" as const,
      is_short_notice: false,
      notified_at: NOTIFIED,
    }
    const a = nextDeadline(input)
    const b = nextDeadline(input)
    expect(a?.nextStage).toBe(b?.nextStage)
    expect(a?.dueAt.getTime()).toBe(b?.dueAt.getTime())
  })
})

describe("escalation flow / idempotency semantics", () => {
  const NOTIFIED = "2026-03-05T08:00:00.000Z"
  const notifiedMs = new Date(NOTIFIED).getTime()

  // Mirrors the decision the cron makes: escalate only when now >= dueAt.
  function isDue(
    stage: "notified" | "reminder_1" | "reminder_2",
    isShort: boolean,
    now: number
  ): boolean {
    const dl = nextDeadline({ stage, is_short_notice: isShort, notified_at: NOTIFIED })
    return dl !== null && now >= dl.dueAt.getTime()
  }

  it("normal flow is notified → reminder_1 → timed_out (single reminder)", () => {
    // Just before 24h: nothing due.
    expect(isDue("notified", false, notifiedMs + 23 * MS_PER_HOUR)).toBe(false)
    // At 24h: reminder becomes due.
    expect(isDue("notified", false, notifiedMs + 24 * MS_PER_HOUR)).toBe(true)
    // After reminder sent, before 48h: timeout not yet due.
    expect(isDue("reminder_1", false, notifiedMs + 47 * MS_PER_HOUR)).toBe(false)
    // At 48h: timeout due.
    expect(isDue("reminder_1", false, notifiedMs + 48 * MS_PER_HOUR)).toBe(true)
  })

  it("does not re-fire the reminder once the record advanced past 'notified'", () => {
    // A second check run at 25h sees the record already at reminder_1.
    // The reminder deadline no longer applies; only the 48h timeout can fire.
    const now = notifiedMs + 25 * MS_PER_HOUR
    expect(isDue("reminder_1", false, now)).toBe(false)
  })

  it("short-notice flow escalates on the 4h/8h schedule", () => {
    expect(isDue("notified", true, notifiedMs + 3 * MS_PER_HOUR)).toBe(false)
    expect(isDue("notified", true, notifiedMs + 4 * MS_PER_HOUR)).toBe(true)
    expect(isDue("reminder_1", true, notifiedMs + 8 * MS_PER_HOUR)).toBe(true)
  })
})
