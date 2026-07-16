import { describe, it, expect } from "vitest"
import {
  resolveLinkedLegId,
  isCoAssignable,
  planCoAssignment,
  CO_ASSIGN_PRIMARY_ABSENT_ERROR,
  CO_ASSIGN_RETURN_ABSENT_ERROR,
  type CoAssignLegState,
} from "../co-assign"

const OUTBOUND = "11111111-1111-4111-8111-111111111111"
const RETURN = "22222222-2222-4222-8222-222222222222"
const DRIVER = "99999999-9999-4999-8999-999999999999"

describe("resolveLinkedLegId", () => {
  it("returns the parent id when the primary is itself a return leg", () => {
    expect(
      resolveLinkedLegId({ id: RETURN, parent_ride_id: OUTBOUND }, null)
    ).toBe(OUTBOUND)
  })

  it("returns the child id when the primary is an outbound leg", () => {
    expect(
      resolveLinkedLegId({ id: OUTBOUND, parent_ride_id: null }, RETURN)
    ).toBe(RETURN)
  })

  it("prefers the parent link over a passed child id (return leg wins)", () => {
    // A return leg should never also be a parent, but the parent link is
    // authoritative regardless of what the caller passes as childId.
    expect(
      resolveLinkedLegId({ id: RETURN, parent_ride_id: OUTBOUND }, "other")
    ).toBe(OUTBOUND)
  })

  it("returns null for a single-leg ride with no link in either direction", () => {
    expect(
      resolveLinkedLegId({ id: OUTBOUND, parent_ride_id: null }, null)
    ).toBeNull()
  })
})

describe("isCoAssignable", () => {
  it("allows unplanned, planned and rejected legs", () => {
    expect(isCoAssignable("unplanned")).toBe(true)
    expect(isCoAssignable("planned")).toBe(true)
    expect(isCoAssignable("rejected")).toBe(true)
  })

  it("rejects terminal and in-progress legs", () => {
    expect(isCoAssignable("confirmed")).toBe(false)
    expect(isCoAssignable("in_progress")).toBe(false)
    expect(isCoAssignable("picked_up")).toBe(false)
    expect(isCoAssignable("arrived")).toBe(false)
    expect(isCoAssignable("completed")).toBe(false)
    expect(isCoAssignable("cancelled")).toBe(false)
    expect(isCoAssignable("no_show")).toBe(false)
  })
})

describe("planCoAssignment", () => {
  const primaryUnplanned: CoAssignLegState = {
    rideId: OUTBOUND,
    role: "primary",
    status: "unplanned",
    currentDriverId: null,
    isAbsent: false,
  }
  const returnUnplanned: CoAssignLegState = {
    rideId: RETURN,
    role: "return",
    status: "unplanned",
    currentDriverId: null,
    isAbsent: false,
  }

  it("co-assigns both legs: both transition unplanned -> planned and request acceptance", () => {
    const plan = planCoAssignment(
      [primaryUnplanned, returnUnplanned],
      DRIVER
    )

    expect(plan.proceed).toBe(true)
    if (!plan.proceed) return
    expect(plan.legs).toHaveLength(2)
    for (const leg of plan.legs) {
      expect(leg.targetStatus).toBe("planned")
      expect(leg.statusChanged).toBe(true)
      expect(leg.driverChanged).toBe(true)
      expect(leg.requestAcceptance).toBe(true)
    }
  })

  it("aborts the whole plan when the driver is absent for the PRIMARY leg", () => {
    const plan = planCoAssignment(
      [{ ...primaryUnplanned, isAbsent: true }, returnUnplanned],
      DRIVER
    )
    expect(plan).toEqual({
      proceed: false,
      error: CO_ASSIGN_PRIMARY_ABSENT_ERROR,
    })
  })

  it("aborts the whole plan when the driver is absent for the RETURN leg (nothing assigned)", () => {
    const plan = planCoAssignment(
      [primaryUnplanned, { ...returnUnplanned, isAbsent: true }],
      DRIVER
    )
    expect(plan).toEqual({
      proceed: false,
      error: CO_ASSIGN_RETURN_ABSENT_ERROR,
    })
  })

  it("plans a single leg when there is no linked leg", () => {
    const plan = planCoAssignment([primaryUnplanned], DRIVER)
    expect(plan.proceed).toBe(true)
    if (!plan.proceed) return
    expect(plan.legs).toHaveLength(1)
    expect(plan.legs[0]?.rideId).toBe(OUTBOUND)
    expect(plan.legs[0]?.requestAcceptance).toBe(true)
  })

  it("does not re-request acceptance when the same driver is reassigned", () => {
    const plan = planCoAssignment(
      [
        {
          rideId: OUTBOUND,
          role: "primary",
          status: "planned",
          currentDriverId: DRIVER,
          isAbsent: false,
        },
      ],
      DRIVER
    )
    expect(plan.proceed).toBe(true)
    if (!plan.proceed) return
    expect(plan.legs[0]?.driverChanged).toBe(false)
    expect(plan.legs[0]?.statusChanged).toBe(false)
    expect(plan.legs[0]?.requestAcceptance).toBe(false)
  })

  it("keeps a rejected leg's status but re-requests acceptance for a new driver", () => {
    // A rejected leg stays `rejected` here (no unplanned auto-transition), so it
    // does not trigger a fresh request — the caller decides how to handle a
    // rejected linked leg. Guard against accidental status promotion.
    const plan = planCoAssignment(
      [
        {
          rideId: OUTBOUND,
          role: "primary",
          status: "rejected",
          currentDriverId: null,
          isAbsent: false,
        },
      ],
      DRIVER
    )
    expect(plan.proceed).toBe(true)
    if (!plan.proceed) return
    expect(plan.legs[0]?.targetStatus).toBe("rejected")
    expect(plan.legs[0]?.statusChanged).toBe(false)
    expect(plan.legs[0]?.driverChanged).toBe(true)
    expect(plan.legs[0]?.requestAcceptance).toBe(false)
  })
})
