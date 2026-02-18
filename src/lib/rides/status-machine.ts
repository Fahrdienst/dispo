/**
 * Ride Status State Machine
 *
 * Enforces the ride lifecycle transitions as defined in ADR-002 Section 5.
 * The database does NOT enforce these transitions via triggers -- this module
 * is the single source of truth for what transitions are valid.
 *
 * All ride status updates MUST call canTransition() before persisting.
 */

import type { Enums } from '@/lib/types/database'

type RideStatus = Enums<'ride_status'>

/**
 * Valid status transitions. Each key maps to the list of statuses
 * that can be reached from it. Terminal statuses map to empty arrays.
 *
 * State diagram:
 *
 *   unplanned -> planned, cancelled
 *   planned -> confirmed, rejected, cancelled
 *   rejected -> planned, cancelled
 *   confirmed -> in_progress, cancelled
 *   in_progress -> picked_up, no_show, cancelled
 *   picked_up -> arrived, cancelled
 *   arrived -> completed, cancelled
 *   completed -> (terminal)
 *   cancelled -> (terminal)
 *   no_show -> (terminal)
 */
const VALID_TRANSITIONS: Record<RideStatus, readonly RideStatus[]> = {
  unplanned: ['planned', 'cancelled'],
  planned: ['confirmed', 'rejected', 'cancelled'],
  rejected: ['planned', 'cancelled'],
  confirmed: ['in_progress', 'cancelled'],
  in_progress: ['picked_up', 'no_show', 'cancelled'],
  picked_up: ['arrived', 'cancelled'],
  arrived: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  no_show: [],
} as const satisfies Record<RideStatus, readonly RideStatus[]>

/** Terminal statuses that cannot transition to any other status. */
const TERMINAL_STATUSES: ReadonlySet<RideStatus> = new Set<RideStatus>([
  'completed',
  'cancelled',
  'no_show',
])

/**
 * Check whether a transition from one status to another is valid.
 *
 * @param from - The current ride status
 * @param to - The desired target status
 * @returns true if the transition is allowed, false otherwise
 */
export function canTransition(from: RideStatus, to: RideStatus): boolean {
  const allowed = VALID_TRANSITIONS[from]
  return allowed.includes(to)
}

/**
 * Get the list of valid target statuses from a given status.
 *
 * @param status - The current ride status
 * @returns Readonly array of valid next statuses (empty for terminal statuses)
 */
export function getValidTransitions(status: RideStatus): readonly RideStatus[] {
  return VALID_TRANSITIONS[status]
}

/**
 * Check whether a status is terminal (no further transitions possible).
 *
 * @param status - The ride status to check
 * @returns true if the status is terminal (completed, cancelled, no_show)
 */
export function isTerminalStatus(status: RideStatus): boolean {
  return TERMINAL_STATUSES.has(status)
}

/**
 * Assert that a transition is valid. Throws if not.
 * Use this in Server Actions before persisting a status change.
 *
 * @param from - The current ride status
 * @param to - The desired target status
 * @throws Error if the transition is not allowed
 */
export function assertTransition(from: RideStatus, to: RideStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Invalid ride status transition: '${from}' -> '${to}'. ` +
        `Allowed transitions from '${from}': [${VALID_TRANSITIONS[from].join(', ')}]`
    )
  }
}
