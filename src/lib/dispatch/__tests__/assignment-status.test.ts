import { describe, it, expect } from "vitest"
import {
  deriveAssignmentStatus,
  deriveAngefragtTiming,
  ASSIGNMENT_STATUS_ORDER,
  ASSIGNMENT_RIDE_STATUSES,
  ASSIGNMENT_STATUS_LABELS,
  ASSIGNMENT_STATUS_COLORS,
  ASSIGNMENT_STATUS_DOT_COLORS,
  ASSIGNMENT_STATUS_BORDER_COLORS,
  ASSIGNMENT_STATUS_TAB_ACTIVE_COLORS,
  type AssignmentStatus,
} from "../assignment-status"
import type { Enums } from "@/lib/types/database"
import type { DeadlineInput } from "@/lib/acceptance/engine"

type RideStatus = Enums<"ride_status">

// Every ride_status value, so the mapping stays exhaustive if the enum changes.
const ALL_RIDE_STATUSES: RideStatus[] = [
  "unplanned",
  "planned",
  "confirmed",
  "rejected",
  "in_progress",
  "picked_up",
  "arrived",
  "completed",
  "cancelled",
  "no_show",
]

describe("deriveAssignmentStatus — the 4 display buckets", () => {
  it("maps the four assignment-relevant statuses 1:1", () => {
    expect(deriveAssignmentStatus("unplanned")).toBe<AssignmentStatus>("offen")
    expect(deriveAssignmentStatus("planned")).toBe<AssignmentStatus>("angefragt")
    expect(deriveAssignmentStatus("confirmed")).toBe<AssignmentStatus>(
      "bestaetigt"
    )
    expect(deriveAssignmentStatus("rejected")).toBe<AssignmentStatus>(
      "abgelehnt"
    )
  })

  it("returns null for in-transport and terminal statuses (out of scope §0)", () => {
    for (const status of [
      "in_progress",
      "picked_up",
      "arrived",
      "completed",
      "cancelled",
      "no_show",
    ] as RideStatus[]) {
      expect(deriveAssignmentStatus(status)).toBeNull()
    }
  })

  it("covers every ride_status value (no throw, valid bucket or null)", () => {
    for (const status of ALL_RIDE_STATUSES) {
      const result = deriveAssignmentStatus(status)
      if (result !== null) {
        expect(ASSIGNMENT_STATUS_ORDER).toContain(result)
      }
    }
  })

  it("exactly the four ASSIGNMENT_RIDE_STATUSES derive to a non-null bucket", () => {
    const nonNull = ALL_RIDE_STATUSES.filter(
      (s) => deriveAssignmentStatus(s) !== null
    )
    expect([...nonNull].sort()).toEqual([...ASSIGNMENT_RIDE_STATUSES].sort())
  })

  it("introduces no new enum values — buckets are a closed set of four", () => {
    expect(ASSIGNMENT_STATUS_ORDER).toHaveLength(4)
    expect(ASSIGNMENT_STATUS_ORDER).toEqual([
      "offen",
      "angefragt",
      "bestaetigt",
      "abgelehnt",
    ])
  })
})

describe("deriveAngefragtTiming — SLA overdue marker (reuses nextDeadline)", () => {
  const NOTIFIED = "2026-07-16T08:00:00.000Z"

  it("no tracking → not overdue, no deadline", () => {
    expect(deriveAngefragtTiming(null)).toEqual({ overdue: false, dueAt: null })
  })

  it("fresh 'notified' before the reminder window → pending, not overdue", () => {
    const tracking: DeadlineInput = {
      stage: "notified",
      is_short_notice: false,
      notified_at: NOTIFIED,
    }
    // 1h after notification — the 24h reminder is far away.
    const now = new Date("2026-07-16T09:00:00.000Z")
    const timing = deriveAngefragtTiming(tracking, now)
    expect(timing.overdue).toBe(false)
    // dueAt = notified + 24h (normal reminder window).
    expect(timing.dueAt?.toISOString()).toBe("2026-07-17T08:00:00.000Z")
  })

  it("'notified' past the reminder window → overdue", () => {
    const tracking: DeadlineInput = {
      stage: "notified",
      is_short_notice: false,
      notified_at: NOTIFIED,
    }
    // 25h later — past the 24h reminder deadline.
    const now = new Date("2026-07-17T09:00:00.000Z")
    expect(deriveAngefragtTiming(tracking, now).overdue).toBe(true)
  })

  it("short-notice uses the shortened 4h window", () => {
    const tracking: DeadlineInput = {
      stage: "notified",
      is_short_notice: true,
      notified_at: NOTIFIED,
    }
    const now = new Date("2026-07-16T09:00:00.000Z")
    const timing = deriveAngefragtTiming(tracking, now)
    // dueAt = notified + 4h.
    expect(timing.dueAt?.toISOString()).toBe("2026-07-16T12:00:00.000Z")
    expect(timing.overdue).toBe(false)
  })

  it("'timed_out' stage → overdue with no further deadline", () => {
    const tracking: DeadlineInput = {
      stage: "timed_out",
      is_short_notice: false,
      notified_at: NOTIFIED,
    }
    expect(deriveAngefragtTiming(tracking)).toEqual({
      overdue: true,
      dueAt: null,
    })
  })
})

describe("display token families are complete for all four buckets", () => {
  for (const status of ASSIGNMENT_STATUS_ORDER) {
    it(`has label + all color tokens for "${status}"`, () => {
      expect(ASSIGNMENT_STATUS_LABELS[status]).toBeTruthy()
      expect(ASSIGNMENT_STATUS_COLORS[status]).toBeTruthy()
      expect(ASSIGNMENT_STATUS_DOT_COLORS[status]).toBeTruthy()
      expect(ASSIGNMENT_STATUS_BORDER_COLORS[status]).toBeTruthy()
      expect(ASSIGNMENT_STATUS_TAB_ACTIVE_COLORS[status]).toBeTruthy()
    })
  }
})
