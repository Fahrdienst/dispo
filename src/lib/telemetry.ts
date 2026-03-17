/**
 * Simple telemetry logging for key business metrics.
 * Replace with PostHog, Mixpanel, or similar in production.
 *
 * Server-only — never import from client components.
 */

interface TelemetryEvent {
  /** Event name, e.g. "ride_created", "login_success" */
  event: string
  /** Arbitrary key-value properties for the event */
  properties?: Record<string, unknown>
  /** Supabase user ID (omit for anonymous events) */
  userId?: string
  /** ISO timestamp; defaults to now if omitted */
  timestamp?: string
}

/**
 * Track a telemetry event.
 *
 * In development: logs to console with structured output.
 * In production: placeholder for analytics endpoint (POST to PostHog, etc.)
 *
 * This function is intentionally fire-and-forget safe:
 * it never throws and never blocks the caller.
 */
export function trackEvent(telemetry: TelemetryEvent): void {
  const entry = {
    ...telemetry,
    timestamp: telemetry.timestamp ?? new Date().toISOString(),
  }

  if (process.env.NODE_ENV === "development") {
    console.info("[telemetry]", entry.event, entry.properties ?? {})
    return
  }

  // Production: structured log for log aggregation (Vercel, Datadog, etc.)
  // When ready, replace with HTTP POST to analytics endpoint.
  console.info(JSON.stringify({ type: "telemetry", ...entry }))
}
