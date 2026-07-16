/**
 * Assignment status: the dispatcher-facing status model for the /dispatch
 * split-view (M15, Issue #168).
 *
 * The split-view groups rides into exactly FOUR buckets — Offen · Angefragt ·
 * Bestätigt · Abgelehnt. Per the AC these are a pure DISPLAY derivation from the
 * existing `ride.status` lifecycle (+ the active `acceptance_tracking` record for
 * timing enrichment). They introduce NO new enum values.
 *
 * Why `ride.status` is authoritative for the bucket:
 * The ride state machine (`src/lib/rides/status-machine.ts`) already encodes the
 * acceptance outcome — `planned` = a driver was requested, `confirmed` = the
 * driver accepted, `rejected` = the driver declined (holding state until the
 * dispatcher re-assigns). So the four buckets map 1:1 onto four lifecycle
 * statuses. `acceptance_tracking` is layered on top only to enrich the
 * "Angefragt" bucket with the SLA countdown / overdue marker (via the shared
 * `nextDeadline` single source of truth) — see `deriveAngefragtTiming`.
 *
 * Rides outside the assignment question (in_progress … no_show) return `null`
 * and are intentionally NOT shown in the split-view (concept §0 scope: the page
 * answers only "who still drives this?").
 *
 * Color system (concept §6, design-owned by Kim): a token family kept SEPARATE
 * from `RIDE_STATUS_*` (4 vs 10 states, partly different meaning) but derived
 * from the same Tailwind families for visual consistency. Badges always render
 * dot + text, never color alone (accessibility).
 */

import type { Enums } from "@/lib/types/database"
import { nextDeadline, type DeadlineInput } from "@/lib/acceptance/engine"

type RideStatus = Enums<"ride_status">

// =============================================================================
// STATUS MODEL
// =============================================================================

export type AssignmentStatus = "offen" | "angefragt" | "bestaetigt" | "abgelehnt"

/**
 * Ordered list of the four buckets, matching the tab order in the UI
 * (concept §2 / Kim §2). Single source of truth for iteration.
 */
export const ASSIGNMENT_STATUS_ORDER: readonly AssignmentStatus[] = [
  "offen",
  "angefragt",
  "bestaetigt",
  "abgelehnt",
] as const

/**
 * The set of `ride.status` values that belong on the split-view. Used to scope
 * the page query so terminal / in-transport rides never load (concept §0).
 */
export const ASSIGNMENT_RIDE_STATUSES: readonly RideStatus[] = [
  "unplanned",
  "planned",
  "confirmed",
  "rejected",
] as const

/**
 * Derive the split-view bucket from a ride's lifecycle status.
 * Pure, no new enum values. Returns `null` for rides outside the assignment
 * question (they are filtered out of the split-view).
 */
export function deriveAssignmentStatus(
  rideStatus: RideStatus
): AssignmentStatus | null {
  switch (rideStatus) {
    case "unplanned":
      return "offen"
    case "planned":
      return "angefragt"
    case "confirmed":
      return "bestaetigt"
    case "rejected":
      return "abgelehnt"
    // in_progress, picked_up, arrived, completed, cancelled, no_show
    default:
      return null
  }
}

// =============================================================================
// ANGEFRAGT TIMING (SLA overdue marker — concept §3.3 / §6)
// =============================================================================

/**
 * Server-computed timing for an "Angefragt" ride, derived from its active
 * acceptance tracking. This is the "+ acceptance_tracking" half of the AC
 * derivation. It reuses `nextDeadline` — the SAME function the cron/reminder
 * engine uses — so the UI never re-derives SLA windows (concept §6, #171).
 *
 * NOTE: this returns a static, request-time snapshot (an `overdue` flag and the
 * absolute `dueAt`). The live per-minute countdown itself is Issue #171; this
 * only provides the anchor it will tick against.
 */
export interface AngefragtTiming {
  /** Whether the next SLA deadline has already passed (reminder/alarm due). */
  overdue: boolean
  /** Absolute instant of the next escalation, or null if none pending. */
  dueAt: Date | null
}

export function deriveAngefragtTiming(
  tracking: DeadlineInput | null,
  now: Date = new Date()
): AngefragtTiming {
  if (!tracking) {
    return { overdue: false, dueAt: null }
  }
  // Already escalated to timeout: overdue, nothing left to count down to.
  if (tracking.stage === "timed_out") {
    return { overdue: true, dueAt: null }
  }
  const deadline = nextDeadline(tracking)
  if (!deadline) {
    return { overdue: false, dueAt: null }
  }
  return {
    overdue: now.getTime() >= deadline.dueAt.getTime(),
    dueAt: deadline.dueAt,
  }
}

// =============================================================================
// DISPLAY TOKENS (labels + colors — concept §6)
// =============================================================================

/** German labels for the four buckets. */
export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  offen: "Offen",
  angefragt: "Angefragt",
  bestaetigt: "Bestätigt",
  abgelehnt: "Abgelehnt",
}

/** Badge background + text classes (concept §6, WCAG AA). */
export const ASSIGNMENT_STATUS_COLORS: Record<AssignmentStatus, string> = {
  offen: "bg-red-100 text-red-800",
  angefragt: "bg-amber-100 text-amber-800",
  bestaetigt: "bg-green-100 text-green-800",
  abgelehnt: "bg-rose-100 text-rose-800",
}

/** Solid dot color inside the badge. */
export const ASSIGNMENT_STATUS_DOT_COLORS: Record<AssignmentStatus, string> = {
  offen: "bg-red-600",
  angefragt: "bg-amber-500",
  bestaetigt: "bg-green-600",
  abgelehnt: "bg-rose-600",
}

/** Left-border color for ride cards (encodes status before the badge is read). */
export const ASSIGNMENT_STATUS_BORDER_COLORS: Record<AssignmentStatus, string> = {
  offen: "border-l-red-600",
  angefragt: "border-l-amber-400",
  bestaetigt: "border-l-green-500",
  abgelehnt: "border-l-rose-500",
}

/** Solid fill for the ACTIVE status tab (inactive tabs use bg-muted). */
export const ASSIGNMENT_STATUS_TAB_ACTIVE_COLORS: Record<
  AssignmentStatus,
  string
> = {
  offen: "bg-red-600 text-white",
  angefragt: "bg-amber-500 text-white",
  bestaetigt: "bg-green-600 text-white",
  abgelehnt: "bg-rose-600 text-white",
}
