import { createAdminClient } from "@/lib/supabase/admin"
import { mailTransport } from "@/lib/mail/transport"
import { getAppUrl } from "@/lib/acceptance/constants"

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00")
  const days = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"]
  const months = [
    "Jan", "Feb", "Mär", "Apr", "Mai", "Jun",
    "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
  ]
  const day = days[date.getDay()]
  return `${day}, ${date.getDate()}. ${months[date.getMonth()]} ${date.getFullYear()}`
}

interface EscalationEmailData {
  driverName: string
  patientName: string
  destinationName: string
  date: string
  pickupTime: string
  direction: string
  dispatchUrl: string
}

function dispatcherEscalationEmail(data: EscalationEmailData): {
  subject: string
  html: string
} {
  const subject = `Zeitueberschreitung: Fahrt am ${data.date} – Fahrer hat nicht reagiert`

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
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
                        <td style="color:#71717a;font-size:13px;padding:4px 0;width:100px;">Fahrer</td>
                        <td style="color:#18181b;font-size:14px;font-weight:500;padding:4px 0;">${data.driverName}</td>
                      </tr>
                      <tr>
                        <td style="color:#71717a;font-size:13px;padding:4px 0;">Patient</td>
                        <td style="color:#18181b;font-size:14px;font-weight:500;padding:4px 0;">${data.patientName}</td>
                      </tr>
                      <tr>
                        <td style="color:#71717a;font-size:13px;padding:4px 0;">Ziel</td>
                        <td style="color:#18181b;font-size:14px;font-weight:500;padding:4px 0;">${data.destinationName}</td>
                      </tr>
                      <tr>
                        <td style="color:#71717a;font-size:13px;padding:4px 0;">Datum</td>
                        <td style="color:#18181b;font-size:14px;font-weight:500;padding:4px 0;">${data.date}</td>
                      </tr>
                      <tr>
                        <td style="color:#71717a;font-size:13px;padding:4px 0;">Abholzeit</td>
                        <td style="color:#18181b;font-size:14px;font-weight:500;padding:4px 0;">${data.pickupTime}</td>
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

  // Load ride with patient and destination
  const { data: ride } = await supabase
    .from("rides")
    .select(`
      id, date, pickup_time, direction,
      patients!inner(first_name, last_name),
      destinations!inner(display_name)
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

  const patient = ride.patients as unknown as { first_name: string; last_name: string }
  const destination = ride.destinations as unknown as { display_name: string }

  const { subject, html } = dispatcherEscalationEmail({
    driverName: `${driver.first_name} ${driver.last_name}`,
    patientName: `${patient.first_name} ${patient.last_name}`,
    destinationName: destination.display_name,
    date: formatDate(ride.date),
    pickupTime: ride.pickup_time,
    direction: ride.direction,
    dispatchUrl: `${appUrl}/dispatch?date=${ride.date}`,
  })

  try {
    await mailTransport.sendMail({
      from: process.env.MAIL_FROM ?? process.env.GMAIL_USER,
      to: recipientEmail,
      subject,
      html,
    })

    await supabase.from("mail_log").insert({
      ride_id: rideId,
      driver_id: driverId,
      template: "dispatcher-escalation",
      recipient: recipientEmail,
      status: "sent",
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
