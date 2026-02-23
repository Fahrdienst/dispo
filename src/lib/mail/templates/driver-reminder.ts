import { createAdminClient } from "@/lib/supabase/admin"
import { mailTransport } from "@/lib/mail/transport"
import { escapeHtml, formatDate, formatTime } from "@/lib/mail/utils"
import { RIDE_DIRECTION_LABELS } from "@/lib/rides/constants"
import { getAppUrl } from "@/lib/acceptance/constants"
import type { AcceptanceStage } from "@/lib/acceptance/types"

interface ReminderEmailData {
  driverName: string
  patientName: string
  destinationName: string
  date: string // Already formatted
  pickupTime: string
  direction: string // Raw enum value
  appUrl: string
  stage: AcceptanceStage
}

function driverReminderEmail(data: ReminderEmailData): {
  subject: string
  html: string
} {
  const isUrgent = data.stage === "reminder_2"
  const subjectPrefix = isUrgent ? "DRINGEND: " : "Erinnerung: "
  const subject = `${subjectPrefix}Fahrt am ${data.date} bestaetigen`

  const directionLabel =
    RIDE_DIRECTION_LABELS[data.direction as keyof typeof RIDE_DIRECTION_LABELS] ?? data.direction

  // Escape all user-provided data for XSS protection
  const driverName = escapeHtml(data.driverName)
  const patientName = escapeHtml(data.patientName)
  const destinationName = escapeHtml(data.destinationName)
  const date = escapeHtml(data.date)
  const pickupTime = escapeHtml(formatTime(data.pickupTime))
  const direction = escapeHtml(directionLabel)

  const urgentBanner = isUrgent
    ? `<tr>
        <td style="background-color:#dc2626;padding:12px 32px;">
          <p style="margin:0;color:#ffffff;font-size:14px;font-weight:600;text-align:center;">
            Antwort dringend erforderlich
          </p>
        </td>
      </tr>`
    : ""

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

          ${urgentBanner}

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;color:#18181b;font-size:16px;">
                Hallo ${driverName},
              </p>
              <p style="margin:0 0 24px;color:#3f3f46;font-size:14px;">
                ${isUrgent
                  ? "Deine Antwort steht noch aus fuer folgende Fahrt:"
                  : "Erinnerung: Bitte bestaetigen oder ablehnen:"}
              </p>

              <!-- Ride details (SEC-M9-008: same minimal fields as assignment) -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;border-radius:6px;padding:16px;margin-bottom:24px;">
                <tr>
                  <td style="padding:6px 16px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color:#71717a;font-size:13px;padding:4px 0;width:100px;">Patient</td>
                        <td style="color:#18181b;font-size:14px;font-weight:500;padding:4px 0;">${patientName}</td>
                      </tr>
                      <tr>
                        <td style="color:#71717a;font-size:13px;padding:4px 0;">Ziel</td>
                        <td style="color:#18181b;font-size:14px;font-weight:500;padding:4px 0;">${destinationName}</td>
                      </tr>
                      <tr>
                        <td style="color:#71717a;font-size:13px;padding:4px 0;">Datum</td>
                        <td style="color:#18181b;font-size:14px;font-weight:500;padding:4px 0;">${date}</td>
                      </tr>
                      <tr>
                        <td style="color:#71717a;font-size:13px;padding:4px 0;">Abholzeit</td>
                        <td style="color:#18181b;font-size:14px;font-weight:500;padding:4px 0;">${pickupTime}</td>
                      </tr>
                      <tr>
                        <td style="color:#71717a;font-size:13px;padding:4px 0;">Richtung</td>
                        <td style="color:#18181b;font-size:14px;font-weight:500;padding:4px 0;">${direction}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA: Link to app (SEC-M9-005: no token in reminder, link to /my/rides) -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${data.appUrl}/my/rides" style="display:inline-block;background-color:#18181b;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:6px;font-size:14px;font-weight:600;">
                      In der App antworten
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
                Du kannst auch ueber den Link in der urspruenglichen E-Mail antworten.
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
 * Send a reminder email to a driver for a pending acceptance.
 * Reminders link to /my/rides (not token URLs) per SEC-M9-005.
 */
export async function sendDriverReminder(
  rideId: string,
  driverId: string,
  stage: AcceptanceStage
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
    console.error("Failed to load ride for reminder:", rideId)
    return
  }

  // Load driver
  const { data: driver } = await supabase
    .from("drivers")
    .select("first_name, last_name, email")
    .eq("id", driverId)
    .single()

  if (!driver) {
    console.error("Driver not found for reminder:", driverId)
    return
  }

  // Resolve email
  let recipientEmail = driver.email
  if (!recipientEmail) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("driver_id", driverId)
      .single()
    recipientEmail = profile?.email ?? null
  }

  if (!recipientEmail) {
    console.error("No email found for driver:", driverId)
    return
  }

  const appUrl = getAppUrl()
  if (!appUrl) {
    console.error("APP_URL not configured, cannot send reminder")
    return
  }

  const patient = ride.patients as unknown as { first_name: string; last_name: string }
  const destination = ride.destinations as unknown as { display_name: string }

  const { subject, html } = driverReminderEmail({
    driverName: `${driver.first_name} ${driver.last_name}`,
    patientName: `${patient.first_name} ${patient.last_name}`,
    destinationName: destination.display_name,
    date: formatDate(ride.date),
    pickupTime: ride.pickup_time,
    direction: ride.direction,
    appUrl,
    stage,
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
      template: `driver-reminder-${stage}`,
      recipient: recipientEmail,
      status: "sent",
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error"
    console.error("Failed to send reminder:", errorMessage)

    await supabase.from("mail_log").insert({
      ride_id: rideId,
      driver_id: driverId,
      template: `driver-reminder-${stage}`,
      recipient: recipientEmail,
      status: "failed",
      error: errorMessage,
    })
  }
}
