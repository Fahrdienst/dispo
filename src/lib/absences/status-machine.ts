/**
 * Driver Absence Status State Machine (Issue #102)
 *
 * Pure, side-effect-free helpers describing the absence lifecycle:
 *   requested -> approved | rejected | cancelled
 *   approved  -> cancelled            (staff only; e.g. revoke a granted absence)
 *   rejected  -> (terminal)
 *   cancelled -> (terminal)
 *
 * This module is the single source of truth the UI consults to decide what a
 * driver may do. The database (RLS + RPCs) remains the authority that actually
 * enforces writes; these helpers only shape what we render.
 *
 * IMPORTANT — driver-side cancellation:
 *   Per the product requirement (#102) a driver may cancel ONLY while the
 *   request is still `requested`. Once staff have `approved` it, the driver can
 *   no longer withdraw it themselves (they must contact the dispatch). The
 *   `cancel_own_absence` RPC is intentionally a little more permissive at the DB
 *   layer, but the UI deliberately narrows this to `requested` via
 *   `canDriverCancel()`.
 */

import type { Enums } from "@/lib/types/database"

export type AbsenceType = Enums<"absence_type">
export type AbsenceStatus = Enums<"absence_status">

// =============================================================================
// GERMAN LABELS
// =============================================================================

/** German display labels for absence types. */
export const ABSENCE_TYPE_LABELS: Record<AbsenceType, string> = {
  vacation: "Ferien",
  sick: "Krank",
  training: "Weiterbildung",
  other: "Sonstiges",
}

/** German display labels for absence statuses. */
export const ABSENCE_STATUS_LABELS: Record<AbsenceStatus, string> = {
  requested: "Beantragt",
  approved: "Genehmigt",
  rejected: "Abgelehnt",
  cancelled: "Storniert",
}

/**
 * Badge colour classes per status (Tailwind, AA contrast).
 * Functional, never decorative — pairs with the text label, never colour alone.
 */
export const ABSENCE_STATUS_BADGE_CLASSES: Record<AbsenceStatus, string> = {
  requested: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  approved: "bg-green-100 text-green-800 hover:bg-green-100",
  rejected: "bg-red-100 text-red-800 hover:bg-red-100",
  cancelled: "bg-slate-100 text-slate-600 hover:bg-slate-100",
}

// =============================================================================
// STATE MACHINE
// =============================================================================

/**
 * All valid status transitions (regardless of who performs them). Terminal
 * statuses map to an empty array.
 */
const VALID_TRANSITIONS: Record<AbsenceStatus, readonly AbsenceStatus[]> = {
  requested: ["approved", "rejected", "cancelled"],
  approved: ["cancelled"],
  rejected: [],
  cancelled: [],
} as const satisfies Record<AbsenceStatus, readonly AbsenceStatus[]>

/** Statuses that cannot transition any further. */
const TERMINAL_STATUSES: ReadonlySet<AbsenceStatus> = new Set<AbsenceStatus>([
  "rejected",
  "cancelled",
])

/**
 * Statuses that count as "active" and therefore block an overlapping request
 * (mirrors the DB exclusion constraint `driver_absences_no_overlap`).
 */
const ACTIVE_STATUSES: ReadonlySet<AbsenceStatus> = new Set<AbsenceStatus>([
  "requested",
  "approved",
])

/** Whether a transition is structurally valid (ignores who performs it). */
export function canTransition(
  from: AbsenceStatus,
  to: AbsenceStatus
): boolean {
  return VALID_TRANSITIONS[from].includes(to)
}

/** Valid next statuses from a given status (empty for terminal statuses). */
export function getValidTransitions(
  status: AbsenceStatus
): readonly AbsenceStatus[] {
  return VALID_TRANSITIONS[status]
}

/** Whether a status is terminal (no further transitions possible). */
export function isTerminalStatus(status: AbsenceStatus): boolean {
  return TERMINAL_STATUSES.has(status)
}

/**
 * Whether an absence in this status occupies its date range (blocks overlap).
 * Kept in sync with the DB exclusion constraint's WHERE clause.
 */
export function isActiveStatus(status: AbsenceStatus): boolean {
  return ACTIVE_STATUSES.has(status)
}

/**
 * Whether the DRIVER themselves may cancel an absence in this status.
 *
 * Only `requested` — once approved, cancellation is a dispatch decision.
 * This is the single predicate the UI uses to show/hide the cancel button.
 */
export function canDriverCancel(status: AbsenceStatus): boolean {
  return status === "requested"
}
