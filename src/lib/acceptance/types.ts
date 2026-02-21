import type { Tables } from "@/lib/types/database"

export type AcceptanceStage =
  | "notified"
  | "reminder_1"
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
  /** Minutes after notification for reminder 1 */
  reminder1: number
  /** Minutes after notification for reminder 2 */
  reminder2: number
  /** Minutes after notification for timeout */
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
