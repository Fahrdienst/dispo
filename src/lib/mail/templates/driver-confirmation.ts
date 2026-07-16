import type { OrderSheetData } from "@/lib/mail/load-order-sheet-data"
import { escapeHtml, formatDate, formatTime } from "@/lib/mail/utils"
import {
  IMPAIRMENT_TYPE_LABELS,
  RIDE_DIRECTION_LABELS,
} from "@/lib/rides/constants"

/**
 * Confirmation email sent to a driver *after* they accept a ride (M15, #166).
 *
 * Post-acceptance, full operational details are permitted (name, exact
 * addresses) — but no health details beyond the mobility aids needed for the
 * transfer (tiered disclosure, Findings #177/#179). Structure mirrors
 * driver-assignment.ts (inline-CSS, 480px, table layout) but carries no action
 * buttons: the decision is already made, the .ics attachment does the rest.
 */

/**
 * Render a single label-value row. Returns empty string for null/empty values
 * so optional fields collapse cleanly.
 */
function row(label: string, value: string | null | undefined): string {
  if (!value) return ""
  return `<tr>
                        <td style="color:#71717a;font-size:13px;padding:4px 0;width:110px;vertical-align:top;">${escapeHtml(label)}</td>
                        <td style="color:#18181b;font-size:14px;font-weight:500;padding:4px 0;">${escapeHtml(value)}</td>
                      </tr>`
}

function joinAddress(
  street: string | null,
  houseNumber: string | null,
  postalCode: string | null,
  city: string | null
): string | null {
  const line1 =
    street && houseNumber ? `${street} ${houseNumber}` : street ?? houseNumber
  const line2 = postalCode && city ? `${postalCode} ${city}` : postalCode ?? city
  const parts = [line1, line2].filter((p): p is string => Boolean(p))
  return parts.length > 0 ? parts.join(", ") : null
}

export function driverConfirmationEmail(data: OrderSheetData): {
  subject: string
  html: string
} {
  const driverName = `${data.driverFirstName} ${data.driverLastName}`.trim()
  const patientName = `${data.patientFirstName} ${data.patientLastName}`.trim()

  const directionLabel =
    RIDE_DIRECTION_LABELS[
      data.direction as keyof typeof RIDE_DIRECTION_LABELS
    ] ?? data.direction

  // For a return ride the patient is collected at the destination; otherwise
  // at their home address.
  const patientAddress = joinAddress(
    data.patientStreet,
    data.patientHouseNumber,
    data.patientPostalCode,
    data.patientCity
  )
  const destinationAddress = joinAddress(
    data.destinationStreet,
    data.destinationHouseNumber,
    data.destinationPostalCode,
    data.destinationCity
  )
  const pickupAddress =
    data.direction === "return" ? destinationAddress : patientAddress

  const impairments =
    data.patientImpairments.length > 0
      ? data.patientImpairments
          .map(
            (imp) =>
              IMPAIRMENT_TYPE_LABELS[
                imp as keyof typeof IMPAIRMENT_TYPE_LABELS
              ] ?? imp
          )
          .join(", ")
      : null

  const formattedDate = formatDate(data.date)
  const pickupTime = formatTime(data.pickupTime)
  const appointmentTime = data.appointmentTime
    ? formatTime(data.appointmentTime)
    : null

  const subject = `Bestätigt: ${formattedDate}, ${pickupTime} Uhr – ${data.destinationName}`

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
            <td style="background-color:#16a34a;padding:24px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:600;">Fahrt bestätigt</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;color:#18181b;font-size:16px;">
                Danke ${escapeHtml(driverName)},
              </p>
              <p style="margin:0 0 24px;color:#3f3f46;font-size:14px;">
                die folgende Fahrt ist für dich eingetragen. Den Kalendereintrag
                findest du als Anhang (fahrt.ics) in dieser E-Mail.
              </p>

              <!-- Ride details -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;border-radius:6px;padding:16px;margin-bottom:24px;">
                <tr>
                  <td style="padding:6px 16px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      ${row("Datum", formattedDate)}
                      ${row("Abholzeit", `${pickupTime} Uhr`)}
                      ${row("Termin", appointmentTime ? `${appointmentTime} Uhr` : null)}
                      ${row("Richtung", directionLabel)}
                      ${row("Fahrgast", patientName)}
                      ${row("Telefon", data.patientPhone)}
                      ${row("Abholadresse", pickupAddress)}
                      ${row("Ziel", data.destinationName)}
                      ${row("Zieladresse", destinationAddress)}
                      ${row("Hilfsmittel", impairments)}
                      ${row("Hinweise", data.notes)}
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0;color:#3f3f46;font-size:14px;">
                Bei Fragen oder Änderungen melde dich bitte bei der Disposition.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #e4e4e7;">
              <p style="margin:0;color:#a1a1aa;font-size:12px;text-align:center;">
                ${escapeHtml(data.organizationName)}
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
