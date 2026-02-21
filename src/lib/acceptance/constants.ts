import type { AcceptanceStage, RejectionReason, SLAWindows } from "./types"

/**
 * SLA windows for normal rides (pickup > 60 min from now).
 * Values in minutes after initial notification.
 */
export const NORMAL_SLA_WINDOWS: SLAWindows = {
  reminder1: 10,
  reminder2: 25,
  timeout: 40,
}

/**
 * SLA windows for short-notice rides (pickup <= 60 min from now).
 * Shortened escalation times for urgent assignments.
 */
export const SHORT_NOTICE_SLA_WINDOWS: SLAWindows = {
  reminder1: 3,
  reminder2: 8,
  timeout: 15,
}

/** Threshold in minutes: pickup within this window = short notice */
export const SHORT_NOTICE_THRESHOLD_MINUTES = 60

/** Active (non-terminal) stages for tracking queries */
export const ACTIVE_STAGES: readonly AcceptanceStage[] = [
  "notified",
  "reminder_1",
  "reminder_2",
] as const

/** Terminal stages (no further escalation) */
export const TERMINAL_STAGES: readonly AcceptanceStage[] = [
  "timed_out",
  "confirmed",
  "rejected",
  "cancelled",
] as const

/** German labels for acceptance stages */
export const ACCEPTANCE_STAGE_LABELS: Record<AcceptanceStage, string> = {
  notified: "Benachrichtigt",
  reminder_1: "Erinnerung 1",
  reminder_2: "Erinnerung 2",
  timed_out: "Zeitueberschreitung",
  confirmed: "Bestaetigt",
  rejected: "Abgelehnt",
  cancelled: "Abgebrochen",
}

/** German labels for rejection reasons */
export const REJECTION_REASON_LABELS: Record<RejectionReason, string> = {
  schedule_conflict: "Terminkonflikt",
  too_far: "Zu weit entfernt",
  vehicle_issue: "Fahrzeugproblem",
  personal: "Persoenliche Gruende",
  other: "Sonstiges",
}

/**
 * Check if the acceptance flow feature is enabled.
 * Server-side only — reads from process.env (SEC-M9-010: no NEXT_PUBLIC_ prefix).
 */
export function isAcceptanceFlowEnabled(): boolean {
  return process.env.ACCEPTANCE_FLOW_ENABLED === "true"
}

/**
 * Get the application base URL with HTTPS validation (SEC-M9-012).
 * Returns null if not configured or if non-HTTPS in production.
 */
export function getAppUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_APP_URL
  if (!url) return null

  // In production, enforce HTTPS
  if (
    process.env.NODE_ENV === "production" &&
    !url.startsWith("https://")
  ) {
    console.error(
      "SEC-M9-012: NEXT_PUBLIC_APP_URL must use HTTPS in production"
    )
    return null
  }

  return url
}
