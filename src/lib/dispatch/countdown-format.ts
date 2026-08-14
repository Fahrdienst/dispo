/**
 * Countdown display formatting for the Angefragt cards (M15, #171).
 *
 * Pure module so the format rules are unit-testable. The countdown shows the
 * time remaining until the NEXT SLA deadline (reminder or dispatcher alarm),
 * matching the concept mockup «⏱ 18h» — coarse on purpose: the dispatcher
 * needs "roughly how long", not seconds.
 */

const MS_PER_MINUTE = 60_000
const MS_PER_HOUR = 3_600_000

/**
 * Format a remaining-time span:
 *
 *   >= 10h        → "18h"        (coarse, hours only)
 *   1h … 10h      → "3h 20m"
 *   1m … 1h       → "45m"
 *   below 1 minute → "<1m"
 *
 * Callers must handle `ms <= 0` themselves (the card switches to «Überfällig»
 * instead of showing negative time).
 */
export function formatRemaining(ms: number): string {
  const totalMinutes = Math.floor(ms / MS_PER_MINUTE)
  if (totalMinutes < 1) return "<1m"

  const hours = Math.floor(ms / MS_PER_HOUR)
  if (hours >= 10) return `${hours}h`

  const minutes = totalMinutes - hours * 60
  if (hours >= 1) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  return `${minutes}m`
}

/** German label for what the deadline escalates to (tooltip text). */
export function deadlineStageLabel(
  nextStage: "reminder_1" | "timed_out"
): string {
  return nextStage === "reminder_1" ? "Erinnerung" : "Dispo-Alarm"
}
