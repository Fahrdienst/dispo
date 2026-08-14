import { createAdminClient } from "@/lib/supabase/admin"
import { sendGuardedMail } from "@/lib/mail/send"
import { escapeHtml, formatDate, formatTime } from "@/lib/mail/utils"
import { getAppUrl } from "@/lib/acceptance/constants"

/**
 * Short, non-identifying ride reference. Format: F-YYMMDD-last4
 * (matches the order-sheet reference, e.g. F-260225-a3f1).
 */
function formatRideRef(date: string, rideId: string): string {
  const [yyyy = "", mm = "", dd = ""] = date.split("-")
  return `F-${yyyy.slice(2)}${mm}${dd}-${rideId.slice(-4)}`
}

/**
 * Data for the dispatcher escalation mail.
 * SEC #186 / data minimization: NO patient PII. The mail carries only the ride
 * reference, time, a coarse region, and a deep link into the authenticated app
 * where the dispatcher sees full details.
 */
interface EscalationEmailData {
  driverName: string
  rideRef: string
  region: string
  date: string // Already formatted
  pickupTime: string
  dispatchUrl: string
}

function dispatcherEscalationEmail(data: EscalationEmailData): {
  subject: string
  html: string
} {
  const subject = `Zeitueberschreitung: Fahrt am ${data.date} – Fahrer hat nicht reagiert`

  // Escape all dynamic data for XSS protection
  const driverName = escapeHtml(data.driverName)
  const rideRef = escapeHtml(data.rideRef)
  const region = escapeHtml(data.region)
  const date = escapeHtml(data.date)
  const pickupTime = escapeHtml(formatTime(data.pickupTime))

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:8px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background-color:#18181b;padding:24px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:600;">Dispo Krankentransport</h1>
            </td>
          </tr>

          <!-- Alert banner -->
          <tr>
            <td style="background-color:#f59e0b;padding:12px 32px;">
              <p style="margin:0;color:#18181b;font-size:14px;font-weight:600;text-align:center;">
                Fahrer-Zeitueberschreitung – Eingreifen erforderlich
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;color:#18181b;font-size:16px;">
                Der zugewiesene Fahrer hat nicht rechtzeitig auf die Fahrtzuweisung reagiert.
              </p>

              <!-- Details -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;border-radius:6px;padding:16px;margin-bottom:24px;">
                <tr>
                  <td style="padding:6px 16px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color:#71717a;font-size:13px;padding:4px 0;width:100px;">Fahrt-Ref.</td>
                        <td style="color:#18181b;font-size:14px;font-weight:500;padding:4px 0;">${rideRef}</td>
                      </tr>
                      <tr>
                        <td style="color:#71717a;font-size:13px;padding:4px 0;">Fahrer</td>
                        <td style="color:#18181b;font-size:14px;font-weight:500;padding:4px 0;">${driverName}</td>
                      </tr>
                      <tr>
                        <td style="color:#71717a;font-size:13px;padding:4px 0;">Region</td>
                        <td style="color:#18181b;font-size:14px;font-weight:500;padding:4px 0;">${region}</td>
                      </tr>
                      <tr>
                        <td style="color:#71717a;font-size:13px;padding:4px 0;">Datum</td>
                        <td style="color:#18181b;font-size:14px;font-weight:500;padding:4px 0;">${date}</td>
                      </tr>
                      <tr>
                        <td style="color:#71717a;font-size:13px;padding:4px 0;">Abholzeit</td>
                        <td style="color:#18181b;font-size:14px;font-weight:500;padding:4px 0;">${pickupTime}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${data.dispatchUrl}" style="display:inline-block;background-color:#18181b;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:6px;font-size:14px;font-weight:600;">
                      Im Dispatch oeffnen
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #e4e4e7;">
              <p style="margin:0;color:#a1a1aa;font-size:12px;text-align:center;">
                Bitte weisen Sie die Fahrt einem anderen Fahrer zu.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject, html }
}

/**
 * Send escalation email to dispatchers when a driver times out.
 */
export async function sendDispatcherEscalation(
  rideId: string,
  driverId: string
): Promise<void> {
  const supabase = createAdminClient()

  // Data minimization (#186): only load a coarse region (destination city),
  // never patient names or the full destination for the escalation mail.
  const { data: ride } = await supabase
    .from("rides")
    .select(`
      id, date, pickup_time,
      destinations!inner(city, postal_code)
    `)
    .eq("id", rideId)
    .single()

  if (!ride) {
    console.error("Failed to load ride for escalation:", rideId)
    return
  }

  // Load driver name
  const { data: driver } = await supabase
    .from("drivers")
    .select("first_name, last_name")
    .eq("id", driverId)
    .single()

  if (!driver) {
    console.error("Driver not found for escalation:", driverId)
    return
  }

  const appUrl = getAppUrl()
  if (!appUrl) {
    console.error("APP_URL not configured, cannot send escalation")
    return
  }

  // Recipient: DISPATCH_NOTIFICATION_EMAIL or fallback to GMAIL_USER
  const recipientEmail =
    process.env.DISPATCH_NOTIFICATION_EMAIL ?? process.env.GMAIL_USER

  if (!recipientEmail) {
    console.error("No dispatch notification email configured")
    return
  }

  const destination = ride.destinations as unknown as {
    city: string | null
    postal_code: string | null
  }
  // Coarse region only — city, or postal code as fallback, never a full address.
  const region = destination.city ?? destination.postal_code ?? "Unbekannt"

  const { subject, html } = dispatcherEscalationEmail({
    driverName: `${driver.first_name} ${driver.last_name}`,
    rideRef: formatRideRef(ride.date, ride.id),
    region,
    date: formatDate(ride.date),
    pickupTime: ride.pickup_time,
    dispatchUrl: `${appUrl}/dispatch?date=${ride.date}`,
  })

  try {
    const guard = await sendGuardedMail({
      from: process.env.MAIL_FROM ?? process.env.GMAIL_USER,
      to: recipientEmail,
      subject,
      html,
      template: "dispatcher-escalation",
    })

    await supabase.from("mail_log").insert({
      ride_id: rideId,
      driver_id: driverId,
      template: "dispatcher-escalation",
      recipient: guard.auditLabel,
      status: guard.logStatus,
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error"
    console.error("Failed to send escalation email:", errorMessage)

    await supabase.from("mail_log").insert({
      ride_id: rideId,
      driver_id: driverId,
      template: "dispatcher-escalation",
      recipient: recipientEmail,
      status: "failed",
      error: errorMessage,
    })
  }
}
