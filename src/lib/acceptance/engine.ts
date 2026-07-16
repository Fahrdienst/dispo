import { createAdminClient } from "@/lib/supabase/admin"
import { zurichWallTimeToUtc } from "@/lib/utils/dates"
import { recordAssignmentEvent } from "./events"
import {
  NORMAL_SLA_WINDOWS,
  SHORT_NOTICE_SLA_WINDOWS,
  SHORT_NOTICE_THRESHOLD_MINUTES,
  ACTIVE_STAGES,
} from "./constants"
import type {
  AcceptanceStage,
  RejectionReason,
  ResolutionMethod,
  EscalationResult,
  NextDeadline,
  SLAWindows,
} from "./types"

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
 * Single source of truth shared by the cron engine (below) and the UI countdown
 * on ride cards, so both compute identical deadlines from the same SLA windows.
 * Returns null for terminal stages or stages with nothing left to escalate.
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

/**
 * Cancel any active acceptance tracking for a ride.
 * Called when a driver is removed or reassigned.
 */
export async function cancelAcceptanceTracking(
  rideId: string
): Promise<void> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from("acceptance_tracking")
    .update({
      stage: "cancelled" as AcceptanceStage,
      resolved_at: new Date().toISOString(),
      resolved_by: "dispatcher_override" as ResolutionMethod,
      updated_at: new Date().toISOString(),
    })
    .eq("ride_id", rideId)
    .in("stage", [...ACTIVE_STAGES])

  if (error) {
    console.error(
      `Failed to cancel acceptance tracking for ride ${rideId}:`,
      error.message
    )
  }
}

/**
 * Create a new acceptance tracking record for a ride assignment.
 * Cancels any existing active tracking first.
 */
export async function createAcceptanceTracking(
  rideId: string,
  driverId: string,
  rideDate: string,
  pickupTime: string
): Promise<void> {
  // Cancel any existing active tracking
  await cancelAcceptanceTracking(rideId)

  const supabase = createAdminClient()
  const shortNotice = isShortNotice(rideDate, pickupTime)

  const { error } = await supabase.from("acceptance_tracking").insert({
    ride_id: rideId,
    driver_id: driverId,
    stage: "notified" as AcceptanceStage,
    is_short_notice: shortNotice,
    notified_at: new Date().toISOString(),
  })

  if (error) {
    console.error(
      `Failed to create acceptance tracking for ride ${rideId}:`,
      error.message
    )
  }
}

/**
 * Atomically escalate a tracking record to the next stage.
 * Only updates if the current stage matches expectedStage (SEC-M9-004).
 * Returns whether the escalation actually happened.
 */
export async function escalateToStage(
  trackingId: string,
  expectedStage: AcceptanceStage,
  nextStage: AcceptanceStage
): Promise<boolean> {
  const supabase = createAdminClient()
  const now = new Date().toISOString()

  const updateData: Record<string, unknown> = {
    stage: nextStage,
    updated_at: now,
  }

  // Set the appropriate timestamp
  if (nextStage === "reminder_1") {
    updateData.reminder_1_at = now
  } else if (nextStage === "reminder_2") {
    updateData.reminder_2_at = now
  } else if (nextStage === "timed_out") {
    updateData.resolved_at = now
    updateData.resolved_by = "timeout" as ResolutionMethod
  }

  const { data, error } = await supabase
    .from("acceptance_tracking")
    .update(updateData)
    .eq("id", trackingId)
    .eq("stage", expectedStage)
    .select("id")
    .single()

  if (error || !data) return false
  return true
}

/**
 * Resolve an acceptance tracking record (confirm, reject, etc.).
 */
export async function resolveAcceptance(
  rideId: string,
  resolution: AcceptanceStage,
  method: ResolutionMethod,
  rejectionCode?: RejectionReason,
  rejectionText?: string
): Promise<void> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from("acceptance_tracking")
    .update({
      stage: resolution,
      resolved_at: new Date().toISOString(),
      resolved_by: method,
      rejection_reason_code: rejectionCode ?? null,
      rejection_reason_text: rejectionText ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("ride_id", rideId)
    .in("stage", [...ACTIVE_STAGES])

  if (error) {
    console.error(
      `Failed to resolve acceptance for ride ${rideId}:`,
      error.message
    )
  }
}

/**
 * Main cron function: check all pending acceptances and escalate as needed.
 * Returns the list of escalation results for logging/monitoring.
 */
export async function checkPendingAcceptances(): Promise<EscalationResult[]> {
  const supabase = createAdminClient()
  const results: EscalationResult[] = []

  // Fetch all active tracking records
  const { data: trackings, error } = await supabase
    .from("acceptance_tracking")
    .select("id, ride_id, driver_id, stage, is_short_notice, notified_at")
    .in("stage", [...ACTIVE_STAGES])

  if (error || !trackings) {
    console.error("Failed to fetch pending acceptances:", error?.message)
    return results
  }

  const now = Date.now()

  for (const tracking of trackings) {
    const currentStage = tracking.stage as AcceptanceStage

    // Shared deadline logic (UI countdown uses the same function).
    const deadline = nextDeadline({
      stage: currentStage,
      is_short_notice: tracking.is_short_notice,
      notified_at: tracking.notified_at,
    })

    // Nothing to escalate yet, or stage is terminal.
    if (!deadline || now < deadline.dueAt.getTime()) {
      continue
    }

    const nextStage = deadline.nextStage

    // Atomic, conditional transition — only succeeds if the stage is still the
    // one we observed (SEC-M9-004 / #186). Guarantees exactly-once escalation
    // even when the cron overlaps or runs more frequently.
    const escalated = await escalateToStage(
      tracking.id,
      currentStage,
      nextStage
    )

    results.push({
      trackingId: tracking.id,
      rideId: tracking.ride_id,
      driverId: tracking.driver_id,
      fromStage: currentStage,
      toStage: nextStage,
      escalated,
    })

    // Only the process that won the atomic transition (escalated === true)
    // acts, so history is recorded and mail is dispatched exactly once (#186).
    if (!escalated) {
      continue
    }

    // Append to the per-ride status history (assignment_events, #164): the
    // system escalated this request. Actor is the system; the reminder stage
    // is kept as human-readable detail.
    if (nextStage === "reminder_1" || nextStage === "reminder_2") {
      await recordAssignmentEvent({
        rideId: tracking.ride_id,
        driverId: tracking.driver_id,
        acceptanceTrackingId: tracking.id,
        event: "reminder_sent",
        actor: "system",
        detail: nextStage,
      })
    } else if (nextStage === "timed_out") {
      await recordAssignmentEvent({
        rideId: tracking.ride_id,
        driverId: tracking.driver_id,
        acceptanceTrackingId: tracking.id,
        event: "timed_out",
        actor: "system",
      })
    }

    // Send reminder email for the reminder stage.
    if (nextStage === "reminder_1" || nextStage === "reminder_2") {
      try {
        const { sendDriverReminder } = await import(
          "@/lib/mail/templates/driver-reminder"
        )
        await sendDriverReminder(
          tracking.ride_id,
          tracking.driver_id,
          nextStage
        )
      } catch (err) {
        console.error(
          `Failed to send reminder for tracking ${tracking.id}:`,
          err
        )
      }
    }

    // Send dispatcher escalation for timeout.
    if (nextStage === "timed_out") {
      try {
        const { sendDispatcherEscalation } = await import(
          "@/lib/mail/templates/dispatcher-escalation"
        )
        await sendDispatcherEscalation(
          tracking.ride_id,
          tracking.driver_id
        )
      } catch (err) {
        console.error(
          `Failed to send escalation for tracking ${tracking.id}:`,
          err
        )
      }
    }
  }

  return results
}
