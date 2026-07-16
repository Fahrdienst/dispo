import type { AcceptanceStage, RejectionReason, SLAWindows } from "./types"

/**
 * One hour expressed in minutes.
 * SLA windows are defined in hours (concept §3.3) but stored and compared in
 * minutes so the escalation engine works on a single unit. Deriving the minute
 * values from this constant keeps the intent readable and avoids magic numbers.
 */
export const MINUTES_PER_HOUR = 60

/**
 * SLA windows for normal rides (ride start >= 48h from now).
 * Concept §3.3: reminder after 24h, dispatcher escalation after 48h.
 * Values are minutes after the initial notification.
 */
export const NORMAL_SLA_WINDOWS: SLAWindows = {
  reminder1: 24 * MINUTES_PER_HOUR, // 24h → 1440 min
  timeout: 48 * MINUTES_PER_HOUR, // 48h → 2880 min
}

/**
 * SLA windows for short-notice rides (ride start < 48h from now).
 * Concept §3.3: shortened to a reminder after 4h and escalation after 8h.
 * Values are minutes after the initial notification.
 */
export const SHORT_NOTICE_SLA_WINDOWS: SLAWindows = {
  reminder1: 4 * MINUTES_PER_HOUR, // 4h → 240 min
  timeout: 8 * MINUTES_PER_HOUR, // 8h → 480 min
}

/**
 * Threshold in minutes: a ride whose start is closer than this is treated as
 * short notice (concept §3.3: «Start < 48h = kurzfristig»). 48h = 2880 min.
 */
export const SHORT_NOTICE_THRESHOLD_MINUTES = 48 * MINUTES_PER_HOUR

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
