import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/require-auth"
import { createClient } from "@/lib/supabase/server"
import { absenceDecisionEmail } from "@/lib/mail/templates/absence-decision"
import type { AbsenceType } from "@/lib/absences/status-machine"

/**
 * GET /api/mail/preview/absence?absence_id=<uuid>&decision=approved|rejected
 *
 * Renders a preview of the absence decision email (#105). The `decision` query
 * param overrides the stored status so both the approved and rejected variants
 * can be previewed regardless of the absence's current state. When omitted, the
 * absence's own status is used (defaulting to 'approved' if still requested).
 *
 * Auth: admin or operator only.
 */
export async function GET(request: Request): Promise<Response> {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const absenceId = searchParams.get("absence_id")
  if (!absenceId) {
    return NextResponse.json(
      { error: "absence_id parameter required" },
      { status: 400 }
    )
  }

  const decisionParam = searchParams.get("decision")
  const overrideDecision =
    decisionParam === "approved" || decisionParam === "rejected"
      ? decisionParam
      : null

  const supabase = await createClient()
  const { data: absence, error } = await supabase
    .from("driver_absences")
    .select(
      `type, status, start_date, end_date, decision_note,
       drivers!inner(first_name, last_name)`
    )
    .eq("id", absenceId)
    .single()

  if (error || !absence) {
    return NextResponse.json({ error: "Absence not found" }, { status: 404 })
  }

  const driver = absence.drivers as unknown as {
    first_name: string
    last_name: string
  }

  // Resolve the decision to preview: explicit override, else stored status,
  // else fall back to 'approved' for a still-requested absence.
  const decision: "approved" | "rejected" =
    overrideDecision ??
    (absence.status === "rejected" ? "rejected" : "approved")

  const { html } = absenceDecisionEmail({
    driverName: `${driver.first_name} ${driver.last_name}`,
    type: absence.type as AbsenceType,
    startDate: absence.start_date,
    endDate: absence.end_date,
    decision,
    note: absence.decision_note,
  })

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })
}
