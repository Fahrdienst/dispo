/**
 * Driver context resolution for the /dispatch split-view (M15, Issue #169).
 *
 * When the dispatcher activates a ride in the left column, the driver panel
 * filters and sorts by that ride: drivers who are available at the ride's
 * pickup time AND have no overlapping ride float to the top; everyone else is
 * grayed out WITH a reason («Ferien bis 20.7.», «Fährt bereits 08:00–10:00»).
 *
 * Pure module (no DB/React/Next) in the style of `assignment-status.ts` /
 * `co-assign.ts` so the ranking + reason logic is unit-testable. The absence
 * REASON is never part of the inputs — the server ships only neutral date
 * ranges (#187), so the strictest guarantee holds by construction.
 */

import {
  resolveAvailability,
  toAvailabilityEntries,
  type TimeWindow,
} from "@/lib/availability/resolve"
import { isTimeWithinWindows } from "@/lib/availability/driver-status"
import { formatDayLabel } from "@/lib/utils/dates"
import type {
  SplitDriver,
  SplitRide,
} from "@/components/dispatch/split-view-types"

/**
 * Context state of one driver relative to the active ride, in display order:
 *
 *  - `verfuegbar`  — inside an availability window, no overlapping ride.
 *  - `konflikt`    — has a time-overlapping ride that day (assignable behind
 *                    the «Trotzdem zuweisen» pre-question).
 *  - `ausserhalb`  — no availability window covering the pickup time
 *                    (assignable behind the same pre-question, #104 pattern).
 *  - `abwesend`    — approved absence covering the ride date. NOT assignable;
 *                    `assignDriver` would hard-reject it server-side anyway.
 */
export type DriverContextState =
  | "verfuegbar"
  | "konflikt"
  | "ausserhalb"
  | "abwesend"

/** Sort rank per state (lower = higher up in the panel). */
const STATE_RANK: Record<DriverContextState, number> = {
  verfuegbar: 0,
  konflikt: 1,
  ausserhalb: 2,
  abwesend: 3,
}

export interface DriverRideContext {
  state: DriverContextState
  /** Human-readable Grund for grayed states; null when `verfuegbar`. */
  reason: string | null
  /** Whether a [Zuweisen] action is offered at all (false only for absent). */
  assignable: boolean
  /**
   * Whether assigning needs the separate «Trotzdem zuweisen?» pre-question
   * before the regular confirm dialog (konflikt / ausserhalb).
   */
  needsOverride: boolean
}

/** Default ride duration when the route has not been calculated (60 min). */
const DEFAULT_RIDE_DURATION_SECONDS = 3600

/** "HH:MM[:SS]" -> minutes since midnight. */
function timeToMinutes(time: string): number {
  const [h = "0", m = "0"] = time.split(":")
  return parseInt(h, 10) * 60 + parseInt(m, 10)
}

/** Minutes since midnight -> "HH:MM". */
function minutesToTime(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(totalMinutes, 1439))
  const h = String(Math.floor(clamped / 60)).padStart(2, "0")
  const m = String(clamped % 60).padStart(2, "0")
  return `${h}:${m}`
}

/** Occupied window [start, end) in minutes for a ride. */
function rideWindow(ride: {
  pickup_time: string
  duration_seconds: number | null
}): { start: number; end: number } {
  const start = timeToMinutes(ride.pickup_time)
  const durationMinutes = Math.ceil(
    (ride.duration_seconds ?? DEFAULT_RIDE_DURATION_SECONDS) / 60
  )
  return { start, end: start + durationMinutes }
}

/**
 * The rides that occupy a driver's time relative to the active ride: same
 * date, requested or confirmed for that driver, and not the active ride itself
 * or its linked leg (the legs of one trip must not conflict with each other —
 * co-assigning both to the same driver is exactly the desired outcome).
 */
function occupyingRides(
  driverId: string,
  activeRide: SplitRide,
  allRides: readonly SplitRide[]
): SplitRide[] {
  return allRides.filter(
    (r) =>
      r.driver_id === driverId &&
      r.date === activeRide.date &&
      (r.assignmentStatus === "angefragt" ||
        r.assignmentStatus === "bestaetigt") &&
      r.id !== activeRide.id &&
      r.id !== activeRide.parent_ride_id &&
      r.parent_ride_id !== activeRide.id
  )
}

/**
 * Resolve one driver's context relative to the active ride.
 *
 * Precedence when several apply: absence > conflict > outside availability.
 * An absent driver is blocked outright; a conflicting one shows the concrete
 * overlapping window (more actionable than the generic availability hint).
 */
export function resolveDriverRideContext(
  activeRide: SplitRide,
  driver: SplitDriver,
  allRides: readonly SplitRide[]
): DriverRideContext {
  // 1) Approved absence covering the ride date (neutral range, #187).
  const absence = driver.absences.find(
    (a) => activeRide.date >= a.start_date && activeRide.date <= a.end_date
  )
  if (absence) {
    return {
      state: "abwesend",
      reason: `Nicht verfügbar bis ${formatDayLabel(absence.end_date)}`,
      assignable: false,
      needsOverride: false,
    }
  }

  // 2) Time conflict with an already requested/confirmed ride that day.
  const active = rideWindow(activeRide)
  const conflicting = occupyingRides(driver.id, activeRide, allRides)
    .map((r) => ({ ride: r, window: rideWindow(r) }))
    .filter(({ window: w }) => w.start < active.end && active.start < w.end)
    .sort((a, b) => a.window.start - b.window.start)[0]

  if (conflicting) {
    return {
      state: "konflikt",
      reason: `Fährt bereits ${minutesToTime(
        conflicting.window.start
      )}–${minutesToTime(conflicting.window.end)}`,
      assignable: true,
      needsOverride: true,
    }
  }

  // 3) Availability windows on the ride date (weekly grid + date exceptions).
  const windows = resolveAvailability(
    activeRide.date,
    toAvailabilityEntries([...driver.availability])
  )
  if (!isTimeWithinWindows(activeRide.pickup_time, windows)) {
    return {
      state: "ausserhalb",
      reason:
        windows.length > 0
          ? `Verfügbar ${formatWindows(windows)}`
          : "Laut Wochenschema nicht verfügbar",
      assignable: true,
      needsOverride: true,
    }
  }

  return {
    state: "verfuegbar",
    reason: null,
    assignable: true,
    needsOverride: false,
  }
}

/** "08:00–12:00, 14:00–16:00" */
function formatWindows(windows: readonly TimeWindow[]): string {
  return windows
    .map((w) => `${w.start.slice(0, 5)}–${w.end.slice(0, 5)}`)
    .join(", ")
}

/**
 * Sort drivers for the context view: available first, then conflict, then
 * outside availability, then absent — alphabetical within each group
 * (matching the panel's default ordering).
 */
export function sortDriversByContext(
  drivers: readonly SplitDriver[],
  contextById: ReadonlyMap<string, DriverRideContext>
): SplitDriver[] {
  return [...drivers].sort((a, b) => {
    const rankA = STATE_RANK[contextById.get(a.id)?.state ?? "verfuegbar"]
    const rankB = STATE_RANK[contextById.get(b.id)?.state ?? "verfuegbar"]
    if (rankA !== rankB) return rankA - rankB
    return (
      a.last_name.localeCompare(b.last_name, "de") ||
      a.first_name.localeCompare(b.first_name, "de")
    )
  })
}
