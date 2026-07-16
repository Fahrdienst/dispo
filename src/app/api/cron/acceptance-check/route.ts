import { NextResponse } from "next/server"
import { isAcceptanceFlowEnabled } from "@/lib/acceptance/constants"
import { checkPendingAcceptances } from "@/lib/acceptance/engine"

/**
 * Vercel Cron endpoint for acceptance tracking escalation.
 * Runs once daily at 06:00 (see vercel.json) to check for overdue driver
 * responses and drive the reminder/escalation windows.
 *
 * Cadence note: the Vercel Hobby plan only permits daily crons (a deliberate
 * decision — no plan upgrade, no external scheduler). Consequences:
 * - The 24h/48h normal windows are only hit at day granularity (a record
 *   crossing its deadline is escalated at the next 06:00 run).
 * - The 4h/8h short-notice windows cannot be met by this daily cron; that
 *   escalation is primarily carried by the fire-and-forget
 *   `checkPendingAcceptances()` call when the dispatch page is loaded, which
 *   catches due deadlines throughout the working day.
 *
 * Auth: CRON_SECRET in Authorization header (Vercel sets this automatically).
 * The response body only contains opaque IDs (ride/driver/tracking UUIDs) — no
 * patient PII is logged or returned (#186).
 */
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check feature flag
  if (!isAcceptanceFlowEnabled()) {
    return NextResponse.json({ skipped: true, reason: "feature_disabled" })
  }

  try {
    const results = await checkPendingAcceptances()
    return NextResponse.json({
      success: true,
      escalations: results.length,
      details: results,
    })
  } catch (err) {
    console.error("Acceptance check cron failed:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
