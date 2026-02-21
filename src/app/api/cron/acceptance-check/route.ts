import { NextResponse } from "next/server"
import { isAcceptanceFlowEnabled } from "@/lib/acceptance/constants"
import { checkPendingAcceptances } from "@/lib/acceptance/engine"

/**
 * Vercel Cron endpoint for acceptance tracking escalation.
 * Runs every minute to check for overdue driver responses.
 *
 * Auth: CRON_SECRET in Authorization header (Vercel sets this automatically).
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
