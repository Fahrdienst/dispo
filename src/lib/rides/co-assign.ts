/**
 * Co-assignment planning for linked ride legs (Issue #167, M15).
 *
 * When a dispatcher assigns a driver to a ride, they may want the *same* driver
 * to take the linked return leg in one action (concept §2.1/§2.3). The link
 * already exists as `rides.parent_ride_id` (self-FK, return leg → outbound leg)
 * — no new column is needed (EPIC #175).
 *
 * This module holds the **pure** decision logic so it can be unit-tested without
 * a database:
 *   - `resolveLinkedLegId`  — which ride is the linked leg (bidirectional).
 *   - `isCoAssignable`      — may a leg receive a co-assignment at all.
 *   - `planCoAssignment`    — atomic go/no-go plan for all legs together.
 *
 * The security-relevant rule (#182) is enforced here: the conflict/absence guard
 * covers *every* leg, and if any leg fails hard the whole plan is rejected
 * (nothing is assigned). The IO orchestration lives in `src/actions/rides.ts`.
 */

import type { Enums } from "@/lib/types/database"

type RideStatus = Enums<"ride_status">

/** Which of the two legs a planned entry refers to (for UI feedback + errors). */
export type LegRole = "primary" | "return"

/**
 * Statuses in which a leg may still receive a driver co-assignment.
 *
 * Terminal legs (`completed`, `cancelled`, `no_show`) and legs already in the
 * ride (`in_progress`, `picked_up`, `arrived`) must never be clobbered by a
 * co-assignment — the linked return leg is silently skipped in those cases, the
 * primary action still succeeds for the leg the dispatcher explicitly picked.
 */
const CO_ASSIGNABLE_STATUSES: ReadonlySet<RideStatus> = new Set<RideStatus>([
  "unplanned",
  "planned",
  "rejected",
])

/** Shown when the driver is on an approved absence at the outbound leg's time. */
export const CO_ASSIGN_PRIMARY_ABSENT_ERROR =
  "Der gewaehlte Fahrer ist an diesem Datum abwesend (Ferien/Abwesenheit). Bitte einen anderen Fahrer waehlen."

/**
 * Shown when the driver is absent at the *return* leg's time. Because the two
 * legs are assigned atomically (#182), nothing is assigned in this case and the
 * dispatcher is told explicitly so they can pick another driver or dispatch the
 * return leg separately.
 */
export const CO_ASSIGN_RETURN_ABSENT_ERROR =
  "Der gewaehlte Fahrer ist zum Zeitpunkt der Rueckfahrt abwesend (Ferien/Abwesenheit). Es wurde keine Fahrt zugewiesen. Bitte einen anderen Fahrer waehlen oder die Rueckfahrt separat disponieren."

/**
 * Determine whether a leg may receive a co-assignment.
 */
export function isCoAssignable(status: RideStatus): boolean {
  return CO_ASSIGNABLE_STATUSES.has(status)
}

/**
 * Resolve the id of the leg linked to `primary` via `parent_ride_id`, in both
 * directions (concept §2.1, issue #167):
 *
 *   - If `primary` is itself a return leg (`parent_ride_id` set), the linked leg
 *     is its parent (the outbound leg).
 *   - Otherwise `primary` is an outbound leg and the linked leg is the return
 *     leg whose `parent_ride_id` points back at it (`childId`, looked up by the
 *     caller).
 *
 * Returns `null` when there is no linked leg (single-leg ride).
 */
export function resolveLinkedLegId(
  primary: { id: string; parent_ride_id: string | null },
  childId: string | null
): string | null {
  if (primary.parent_ride_id) return primary.parent_ride_id
  return childId
}

/** Input state for one leg going into the co-assignment plan. */
export interface CoAssignLegState {
  rideId: string
  role: LegRole
  status: RideStatus
  currentDriverId: string | null
  /** From `getDriverDayStatus`: driver is on an approved absence that day/time. */
  isAbsent: boolean
}

/** A single leg's resolved assignment action. */
export interface PlannedLeg {
  rideId: string
  role: LegRole
  targetStatus: RideStatus
  statusChanged: boolean
  driverChanged: boolean
  /**
   * Whether this leg needs a fresh acceptance request (tracking + mail + event):
   * true when a (new) driver is assigned and the leg ends up `planned`.
   */
  requestAcceptance: boolean
}

export type CoAssignPlan =
  | { proceed: false; error: string }
  | { proceed: true; legs: PlannedLeg[] }

/**
 * Build the atomic co-assignment plan for one or two legs.
 *
 * Security rule (#182): if the driver is absent for *any* leg, the whole plan is
 * rejected and nothing is assigned. Only when every leg passes the guard is a
 * `proceed: true` plan returned, so the caller can apply the DB updates.
 *
 * `newDriverId` must be non-null — this action only assigns drivers; removal
 * goes through `assignDriver`.
 */
export function planCoAssignment(
  legs: CoAssignLegState[],
  newDriverId: string
): CoAssignPlan {
  // Hard guard first (before deciding any transition): a single absent leg
  // aborts the entire operation. The primary leg's message matches the existing
  // single-assign flow; the return leg gets a dedicated message.
  for (const leg of legs) {
    if (leg.isAbsent) {
      return {
        proceed: false,
        error:
          leg.role === "primary"
            ? CO_ASSIGN_PRIMARY_ABSENT_ERROR
            : CO_ASSIGN_RETURN_ABSENT_ERROR,
      }
    }
  }

  const planned: PlannedLeg[] = legs.map((leg) => {
    // Mirror the single-assign auto-transition: an unplanned leg with no driver
    // becomes `planned` when a driver is set. Any other status is preserved.
    const targetStatus: RideStatus =
      leg.status === "unplanned" && !leg.currentDriverId
        ? "planned"
        : leg.status

    const driverChanged = newDriverId !== leg.currentDriverId

    return {
      rideId: leg.rideId,
      role: leg.role,
      targetStatus,
      statusChanged: targetStatus !== leg.status,
      driverChanged,
      // A fresh request is needed when we newly (re)assign the driver and the
      // leg is in the `planned` state awaiting acceptance.
      requestAcceptance: driverChanged && targetStatus === "planned",
    }
  })

  return { proceed: true, legs: planned }
}
