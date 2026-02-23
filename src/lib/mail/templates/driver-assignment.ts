import { RIDE_DIRECTION_LABELS } from "@/lib/rides/constants"
import { escapeHtml, formatTime } from "@/lib/mail/utils"

export interface DriverAssignmentData {
  driverName: string
  patientName: string
  destinationName: string
  date: string // Already formatted (e.g. "Mittwoch, 25. Februar 2026")
  pickupTime: string
  direction: string // Raw enum value (outbound/return/both)
  confirmUrl: string
  rejectUrl: string
}

export function driverAssignmentEmail(data: DriverAssignmentData): {
  subject: string
  html: string
} {
  const directionLabel =
    RIDE_DIRECTION_LABELS[data.direction as keyof typeof RIDE_DIRECTION_LABELS] ?? data.direction

  // Escape all user-provided data for XSS protection
  const driverName = escapeHtml(data.driverName)
  const patientName = escapeHtml(data.patientName)
  const destinationName = escapeHtml(data.destinationName)
  const date = escapeHtml(data.date)
  const pickupTime = escapeHtml(formatTime(data.pickupTime))
  const direction = escapeHtml(directionLabel)

  const subject = `Neue Fahrt am ${data.date}`

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

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;color:#18181b;font-size:16px;">
                Hallo ${driverName},
              </p>
              <p style="margin:0 0 24px;color:#3f3f46;font-size:14px;">
                Dir wurde eine neue Fahrt zugewiesen:
              </p>

              <!-- Ride details -->
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

              <!-- Action buttons -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:12px;">
                    <a href="${data.confirmUrl}" style="display:inline-block;background-color:#16a34a;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:6px;font-size:14px;font-weight:600;">
                      Fahrt annehmen
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <a href="${data.rejectUrl}" style="display:inline-block;background-color:#dc2626;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:6px;font-size:14px;font-weight:600;">
                      Fahrt ablehnen
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
                Dieser Link ist 48 Stunden gueltig und kann nur einmal verwendet werden.
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
