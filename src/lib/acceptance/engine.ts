import { createAdminClient } from "@/lib/supabase/admin"
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
  SLAWindows,
} from "./types"

/**
 * Determine if a ride is short-notice based on pickup time.
 * Short-notice = pickup is less than 60 minutes from now.
 */
export function isShortNotice(rideDate: string, pickupTime: string): boolean {
  const pickupDateTime = new Date(`${rideDate}T${pickupTime}`)
  const now = new Date()
  const diffMs = pickupDateTime.getTime() - now.getTime()
  const diffMinutes = diffMs / (1000 * 60)
  return diffMinutes < SHORT_NOTICE_THRESHOLD_MINUTES
}

/**
 * Get the appropriate SLA windows based on short-notice status.
 */
export function getSLAWindows(shortNotice: boolean): SLAWindows {
  return shortNotice ? SHORT_NOTICE_SLA_WINDOWS : NORMAL_SLA_WINDOWS
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
    const windows = getSLAWindows(tracking.is_short_notice)
    const notifiedAt = new Date(tracking.notified_at).getTime()
    const minutesSinceNotified = (now - notifiedAt) / (1000 * 60)

    let nextStage: AcceptanceStage | null = null
    const currentStage = tracking.stage as AcceptanceStage

    if (
      currentStage === "notified" &&
      minutesSinceNotified >= windows.reminder1
    ) {
      nextStage = "reminder_1"
    } else if (
      currentStage === "reminder_1" &&
      minutesSinceNotified >= windows.reminder2
    ) {
      nextStage = "reminder_2"
    } else if (
      currentStage === "reminder_2" &&
      minutesSinceNotified >= windows.timeout
    ) {
      nextStage = "timed_out"
    }

    if (nextStage) {
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

      // Send reminder emails for reminder stages
      if (escalated && (nextStage === "reminder_1" || nextStage === "reminder_2")) {
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

      // Send dispatcher escalation for timeout
      if (escalated && nextStage === "timed_out") {
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
  }

  return results
}
