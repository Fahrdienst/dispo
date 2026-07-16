import { NextResponse } from "next/server"
import { isAcceptanceFlowEnabled } from "@/lib/acceptance/constants"
import { checkPendingAcceptances } from "@/lib/acceptance/engine"

/**
 * Vercel Cron endpoint for acceptance tracking escalation.
 * Runs hourly (see vercel.json) to check for overdue driver responses and
 * drive the 24h/48h — resp. 4h/8h short-notice — reminder/escalation windows.
 * The fire-and-forget call on the dispatch page is a supplementary safety net.
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
