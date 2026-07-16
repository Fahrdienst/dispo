import type { Tables } from "@/lib/types/database"

export type AcceptanceStage =
  | "notified"
  | "reminder_1"
  /**
   * @deprecated Concept §3.3 defines a single reminder followed by escalation,
   * so the engine no longer transitions into `reminder_2`. The value is kept
   * because it still exists in the DB enum; legacy records at this stage are
   * still escalated to `timed_out`.
   */
  | "reminder_2"
  | "timed_out"
  | "confirmed"
  | "rejected"
  | "cancelled"

export type RejectionReason =
  | "schedule_conflict"
  | "too_far"
  | "vehicle_issue"
  | "personal"
  | "other"

export type ResolutionMethod =
  | "driver_email"
  | "driver_app"
  | "dispatcher_override"
  | "timeout"

export type AcceptanceTracking = Tables<"acceptance_tracking">

export interface SLAWindows {
  /** Minutes after notification until the single reminder is sent (concept §3.3). */
  reminder1: number
  /** Minutes after notification until dispatcher escalation (timeout). */
  timeout: number
}

export interface EscalationResult {
  trackingId: string
  rideId: string
  driverId: string
  fromStage: AcceptanceStage
  toStage: AcceptanceStage
  escalated: boolean
}

/**
 * The next pending escalation for an active tracking record.
 * Shared between the cron engine and the UI countdown so both compute the
 * same deadline from the same SLA windows.
 */
export interface NextDeadline {
  /** Stage the record transitions into once `dueAt` passes. */
  nextStage: AcceptanceStage
  /** Absolute instant at which the next escalation becomes due. */
  dueAt: Date
}
