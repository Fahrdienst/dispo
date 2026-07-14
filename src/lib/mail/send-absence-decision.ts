import { createAdminClient } from "@/lib/supabase/admin"
import { mailTransport } from "@/lib/mail/transport"
import { absenceDecisionEmail } from "@/lib/mail/templates/absence-decision"
import type { AbsenceType } from "@/lib/absences/status-machine"

/**
 * Notify a driver that their absence request was approved or rejected
 * (Issue #105).
 *
 * IMPORTANT — failure semantics:
 *   The decision is already committed in the database by the time this runs.
 *   A mail failure must NEVER roll the decision back. This function therefore
 *   NEVER throws: every failure path is logged (console.error + mail_log) and
 *   returns quietly. Callers can fire-and-forget it.
 *
 * Uses the admin (service-role) client because it runs after the decision and
 * only reads/writes rows the staff decision already authorised.
 */
export async function sendAbsenceDecisionNotification(
  absenceId: string
): Promise<void> {
  const supabase = createAdminClient()

  // 1. Load the decided absence together with the driver.
  const { data: absence, error } = await supabase
    .from("driver_absences")
    .select(
      `id, driver_id, type, status, start_date, end_date, decision_note,
       drivers!inner(first_name, last_name, email)`
    )
    .eq("id", absenceId)
    .single()

  if (error || !absence) {
    console.error(
      "Absence decision mail: absence not found",
      absenceId,
      error?.message
    )
    return
  }

  // Only approved/rejected are notifiable decisions.
  if (absence.status !== "approved" && absence.status !== "rejected") {
    console.error(
      "Absence decision mail: unexpected status, skipping",
      absence.status
    )
    return
  }

  const driver = absence.drivers as unknown as {
    first_name: string
    last_name: string
    email: string | null
  }

  // 2. Resolve recipient: drivers.email preferred, profiles.email fallback.
  let recipientEmail = driver.email
  if (!recipientEmail) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("driver_id", absence.driver_id)
      .single()
    recipientEmail = profile?.email ?? null
  }

  if (!recipientEmail) {
    console.error(
      "Absence decision mail: no email for driver",
      absence.driver_id
    )
    await logMail(supabase, absence.driver_id, "unknown", "failed", "No email")
    return
  }

  // 3. Render template.
  const { subject, html } = absenceDecisionEmail({
    driverName: `${driver.first_name} ${driver.last_name}`,
    type: absence.type as AbsenceType,
    startDate: absence.start_date,
    endDate: absence.end_date,
    decision: absence.status,
    note: absence.decision_note,
  })

  // 4. Send. A transport failure is logged but never thrown.
  try {
    await mailTransport.sendMail({
      from: process.env.MAIL_FROM ?? process.env.GMAIL_USER,
      to: recipientEmail,
      subject,
      html,
    })
    await logMail(supabase, absence.driver_id, recipientEmail, "sent", null)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("Absence decision mail: send failed", message)
    await logMail(supabase, absence.driver_id, recipientEmail, "failed", message)
  }
}

/** Best-effort mail_log write (ride_id is null for absence mails). */
async function logMail(
  supabase: ReturnType<typeof createAdminClient>,
  driverId: string,
  recipient: string,
  status: "sent" | "failed",
  error: string | null
): Promise<void> {
  try {
    await supabase.from("mail_log").insert({
      ride_id: null,
      driver_id: driverId,
      template: "absence-decision",
      recipient,
      status,
      error,
    })
  } catch {
    // A logging failure must not affect the decision flow.
  }
}
