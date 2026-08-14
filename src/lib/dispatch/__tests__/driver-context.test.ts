import { describe, it, expect } from "vitest"
import {
  resolveDriverRideContext,
  sortDriversByContext,
  type DriverRideContext,
} from "@/lib/dispatch/driver-context"
import type {
  SplitDriver,
  SplitRide,
} from "@/components/dispatch/split-view-types"

// -- Fixtures ----------------------------------------------------------------

/** Thursday 2026-07-16 is a real Thursday. */
const RIDE_DATE = "2026-07-16"

function makeRide(overrides: Partial<SplitRide> = {}): SplitRide {
  return {
    id: "ride-active",
    date: RIDE_DATE,
    pickup_time: "08:30:00",
    status: "unplanned",
    assignmentStatus: "offen",
    direction: "outbound",
    patient_first_name: "Hans",
    patient_last_name: "Brunner",
    patient_city: "Muri AG",
    destination_name: "KSA Aarau",
    requirements: [],
    parent_ride_id: null,
    driver_id: null,
    duration_seconds: 1800, // 30 min
    assigned_driver_name: null,
    linked_return_time: null,
    overdue: false,
    next_deadline_at: null,
    next_deadline_stage: null,
    rejected_by_name: null,
    rejected_at: null,
    ...overrides,
  }
}

function makeDriver(overrides: Partial<SplitDriver> = {}): SplitDriver {
  return {
    id: "driver-1",
    first_name: "Ruth",
    last_name: "Meier",
    vehicle_type: "standard",
    today_slots: [],
    is_absent_today: false,
    absent_until: null,
    period_ride_count: 0,
    // Thursday 08:00–12:00 by default
    availability: [
      {
        day_of_week: "thursday",
        specific_date: null,
        start_time: "08:00:00",
        end_time: "12:00:00",
      },
    ],
    absences: [],
    ...overrides,
  }
}

// -- resolveDriverRideContext ------------------------------------------------

describe("resolveDriverRideContext", () => {
  it("is verfuegbar when the pickup time is inside a window and no conflict exists", () => {
    const ctx = resolveDriverRideContext(makeRide(), makeDriver(), [makeRide()])
    expect(ctx.state).toBe("verfuegbar")
    expect(ctx.reason).toBeNull()
    expect(ctx.assignable).toBe(true)
    expect(ctx.needsOverride).toBe(false)
  })

  it("is abwesend (not assignable) when an absence covers the ride date", () => {
    const driver = makeDriver({
      absences: [{ start_date: "2026-07-10", end_date: "2026-07-20" }],
    })
    const ctx = resolveDriverRideContext(makeRide(), driver, [makeRide()])
    expect(ctx.state).toBe("abwesend")
    expect(ctx.assignable).toBe(false)
    expect(ctx.needsOverride).toBe(false)
    expect(ctx.reason).toContain("Nicht verfügbar bis")
    expect(ctx.reason).toContain("20.07.")
  })

  it("never leaks an absence reason — only the neutral date range exists", () => {
    // #187 holds by construction: SplitDriverAbsence has no type/reason field.
    const driver = makeDriver({
      absences: [{ start_date: RIDE_DATE, end_date: RIDE_DATE }],
    })
    const ctx = resolveDriverRideContext(makeRide(), driver, [makeRide()])
    expect(ctx.reason).not.toMatch(/krank|ferien|urlaub/i)
  })

  it("flags a time conflict with an overlapping requested ride (with window)", () => {
    const active = makeRide()
    const other = makeRide({
      id: "ride-other",
      pickup_time: "08:00:00",
      duration_seconds: 3600, // 08:00–09:00 overlaps 08:30–09:00
      status: "planned",
      assignmentStatus: "angefragt",
      driver_id: "driver-1",
    })
    const ctx = resolveDriverRideContext(active, makeDriver(), [active, other])
    expect(ctx.state).toBe("konflikt")
    expect(ctx.reason).toBe("Fährt bereits 08:00–09:00")
    expect(ctx.assignable).toBe(true)
    expect(ctx.needsOverride).toBe(true)
  })

  it("uses the 60-min fallback when the other ride has no duration", () => {
    const active = makeRide({ pickup_time: "08:50:00" })
    const other = makeRide({
      id: "ride-other",
      pickup_time: "08:00:00",
      duration_seconds: null, // 08:00–09:00 fallback
      status: "confirmed",
      assignmentStatus: "bestaetigt",
      driver_id: "driver-1",
    })
    const ctx = resolveDriverRideContext(active, makeDriver(), [active, other])
    expect(ctx.state).toBe("konflikt")
  })

  it("ignores rides on other dates, other drivers and non-active buckets", () => {
    const active = makeRide()
    const sameTimeOtherDay = makeRide({
      id: "r1",
      date: "2026-07-17",
      driver_id: "driver-1",
      status: "confirmed",
      assignmentStatus: "bestaetigt",
    })
    const otherDriver = makeRide({
      id: "r2",
      driver_id: "driver-2",
      status: "confirmed",
      assignmentStatus: "bestaetigt",
    })
    const openRide = makeRide({ id: "r3", driver_id: "driver-1" }) // offen
    const ctx = resolveDriverRideContext(active, makeDriver(), [
      active,
      sameTimeOtherDay,
      otherDriver,
      openRide,
    ])
    expect(ctx.state).toBe("verfuegbar")
  })

  it("does not count the linked return leg as a conflict", () => {
    // Outbound 08:30 with linked return leg 08:45 (same trip, overlapping
    // fallback windows) — co-assigning both to one driver is the GOAL.
    const active = makeRide()
    const returnLeg = makeRide({
      id: "ride-return",
      pickup_time: "08:45:00",
      parent_ride_id: "ride-active",
      status: "planned",
      assignmentStatus: "angefragt",
      driver_id: "driver-1",
    })
    const ctx = resolveDriverRideContext(active, makeDriver(), [
      active,
      returnLeg,
    ])
    expect(ctx.state).toBe("verfuegbar")
  })

  it("is ausserhalb with the driver's actual windows when the time misses them", () => {
    const active = makeRide({ pickup_time: "14:00:00" })
    const ctx = resolveDriverRideContext(active, makeDriver(), [active])
    expect(ctx.state).toBe("ausserhalb")
    expect(ctx.reason).toBe("Verfügbar 08:00–12:00")
    expect(ctx.assignable).toBe(true)
    expect(ctx.needsOverride).toBe(true)
  })

  it("is ausserhalb with a schema hint when the driver has no windows that day", () => {
    const driver = makeDriver({ availability: [] })
    const ctx = resolveDriverRideContext(makeRide(), driver, [makeRide()])
    expect(ctx.state).toBe("ausserhalb")
    expect(ctx.reason).toBe("Laut Wochenschema nicht verfügbar")
  })

  it("prefers absence over conflict and conflict over availability", () => {
    const active = makeRide()
    const overlapping = makeRide({
      id: "ride-other",
      status: "confirmed",
      assignmentStatus: "bestaetigt",
      driver_id: "driver-1",
    })
    // Absent + conflicting + outside → abwesend wins.
    const absent = makeDriver({
      availability: [],
      absences: [{ start_date: RIDE_DATE, end_date: RIDE_DATE }],
    })
    expect(
      resolveDriverRideContext(active, absent, [active, overlapping]).state
    ).toBe("abwesend")
    // Conflicting + outside → konflikt wins.
    const conflicting = makeDriver({ availability: [] })
    expect(
      resolveDriverRideContext(active, conflicting, [active, overlapping]).state
    ).toBe("konflikt")
  })
})

// -- sortDriversByContext ----------------------------------------------------

describe("sortDriversByContext", () => {
  const ctx = (state: DriverRideContext["state"]): DriverRideContext => ({
    state,
    reason: state === "verfuegbar" ? null : "x",
    assignable: state !== "abwesend",
    needsOverride: state === "konflikt" || state === "ausserhalb",
  })

  it("orders verfuegbar → konflikt → ausserhalb → abwesend, alphabetical within", () => {
    const drivers = [
      makeDriver({ id: "a", last_name: "Steiner" }), // abwesend
      makeDriver({ id: "b", last_name: "Frei" }), // verfuegbar
      makeDriver({ id: "c", last_name: "Zbinden" }), // verfuegbar
      makeDriver({ id: "d", last_name: "Meier" }), // konflikt
      makeDriver({ id: "e", last_name: "Arnold" }), // ausserhalb
    ]
    const map = new Map<string, DriverRideContext>([
      ["a", ctx("abwesend")],
      ["b", ctx("verfuegbar")],
      ["c", ctx("verfuegbar")],
      ["d", ctx("konflikt")],
      ["e", ctx("ausserhalb")],
    ])
    expect(sortDriversByContext(drivers, map).map((d) => d.id)).toEqual([
      "b",
      "c",
      "d",
      "e",
      "a",
    ])
  })
})
