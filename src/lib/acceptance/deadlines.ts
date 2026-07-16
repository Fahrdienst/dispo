/**
 * Pure SLA deadline math for the acceptance flow (concept §3.3).
 *
 * This module is intentionally FREE of any server-only dependency (no admin
 * Supabase client, no mail transport) so it can be imported from BOTH the cron
 * engine (`engine.ts`) and client-side UI (the dispatch split-view countdown,
 * #171) without dragging Node-only modules like `nodemailer` into the browser
 * bundle. `engine.ts` re-exports these symbols for backward compatibility.
 *
 * `nextDeadline` is the single source of truth shared by the cron escalation and
 * the UI countdown, so both compute identical deadlines from the same SLA
 * windows.
 */

import { zurichWallTimeToUtc } from "@/lib/utils/dates"
import {
  NORMAL_SLA_WINDOWS,
  SHORT_NOTICE_SLA_WINDOWS,
  SHORT_NOTICE_THRESHOLD_MINUTES,
} from "./constants"
import type { AcceptanceStage, NextDeadline, SLAWindows } from "./types"

const MS_PER_MINUTE = 60 * 1000

/**
 * Determine if a ride is short-notice based on its start time.
 * Short-notice = ride start is less than SHORT_NOTICE_THRESHOLD_MINUTES (48h)
 * from now. The ride date + pickup time are wall-clock values in Europe/Zurich
 * and are converted to an absolute instant so the comparison is timezone-safe
 * (the server runtime is UTC).
 */
export function isShortNotice(rideDate: string, pickupTime: string): boolean {
  const pickupInstantMs = zurichWallTimeToUtc(rideDate, pickupTime).getTime()
  const diffMinutes = (pickupInstantMs - Date.now()) / MS_PER_MINUTE
  return diffMinutes < SHORT_NOTICE_THRESHOLD_MINUTES
}

/**
 * Get the appropriate SLA windows based on short-notice status.
 */
export function getSLAWindows(shortNotice: boolean): SLAWindows {
  return shortNotice ? SHORT_NOTICE_SLA_WINDOWS : NORMAL_SLA_WINDOWS
}

/** Minimal shape needed to compute a deadline (subset of acceptance_tracking). */
export interface DeadlineInput {
  stage: AcceptanceStage
  is_short_notice: boolean
  notified_at: string
}

/**
 * Compute the next escalation deadline for a tracking record.
 *
 * Single source of truth shared by the cron engine and the UI countdown, so
 * both compute identical deadlines from the same SLA windows. Returns null for
 * terminal stages or stages with nothing left to escalate.
 *
 * Note: per concept §3.3 the flow is `notified → reminder_1 → timed_out`
 * (one reminder). Legacy `reminder_2` records still escalate to `timed_out`.
 */
export function nextDeadline(tracking: DeadlineInput): NextDeadline | null {
  const windows = getSLAWindows(tracking.is_short_notice)
  const notifiedAtMs = new Date(tracking.notified_at).getTime()

  switch (tracking.stage) {
    case "notified":
      return {
        nextStage: "reminder_1",
        dueAt: new Date(notifiedAtMs + windows.reminder1 * MS_PER_MINUTE),
      }
    case "reminder_1":
    case "reminder_2":
      return {
        nextStage: "timed_out",
        dueAt: new Date(notifiedAtMs + windows.timeout * MS_PER_MINUTE),
      }
    default:
      return null
  }
}
