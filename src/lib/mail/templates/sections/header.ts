import type { OrderSheetData } from "@/lib/mail/load-order-sheet-data"
import { escapeHtml, formatDate, formatTime } from "@/lib/mail/utils"
import {
  RIDE_DIRECTION_LABELS,
  RIDE_STATUS_LABELS,
} from "@/lib/rides/constants"

/**
 * Generate the short order reference number.
 * Format: F-YYMMDD-last4 (e.g. F-260225-a3f1)
 */
function formatOrderRef(date: string, rideId: string): string {
  // date is YYYY-MM-DD, extract YY, MM, DD
  const parts = date.split("-")
  const yy = (parts[0] ?? "").slice(2)
  const mm = parts[1] ?? ""
  const dd = parts[2] ?? ""
  const last4 = rideId.slice(-4)
  return `F-${yy}${mm}${dd}-${last4}`
}

/**
 * Render the header section of the order sheet email.
 * Contains: title, order reference, date, pickup time (highlighted),
 * appointment time, direction, return pickup time, and status.
 */
export function renderHeader(data: OrderSheetData): string {
  const orderRef = formatOrderRef(data.date, data.rideId)
  const formattedDate = escapeHtml(formatDate(data.date))
  const pickupTime = escapeHtml(formatTime(data.pickupTime))
  const directionLabel = escapeHtml(
    RIDE_DIRECTION_LABELS[data.direction as keyof typeof RIDE_DIRECTION_LABELS] ??
      data.direction
  )
  const statusLabel = escapeHtml(
    RIDE_STATUS_LABELS[data.status as keyof typeof RIDE_STATUS_LABELS] ??
      data.status
  )

  // Optional rows
  const appointmentRow = data.appointmentTime
    ? `<tr>
        <td style="color:#71717a;font-size:13px;padding:4px 0;width:140px;">Termin</td>
        <td style="color:#1a1a1a;font-size:14px;font-weight:500;padding:4px 0;">${escapeHtml(formatTime(data.appointmentTime))}</td>
      </tr>`
    : ""

  const returnRow = data.returnPickupTime
    ? `<tr>
        <td style="color:#71717a;font-size:13px;padding:4px 0;width:140px;">R&uuml;ckfahrt ca.</td>
        <td style="color:#1a1a1a;font-size:14px;font-weight:500;padding:4px 0;">${escapeHtml(formatTime(data.returnPickupTime))}</td>
      </tr>`
    : ""

  return `<!-- Header & Order Overview -->
<tr>
  <td style="background-color:#18181b;padding:24px 32px;">
    <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.01em;">Patienten-Fahrdienst D&uuml;bendorf</h1>
  </td>
</tr>
<tr>
  <td style="padding:24px 32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="color:#71717a;font-size:13px;padding:4px 0;width:140px;">Auftrags-Nr.</td>
        <td style="color:#1a1a1a;font-size:14px;font-weight:600;padding:4px 0;">${escapeHtml(orderRef)}</td>
      </tr>
      <tr>
        <td style="color:#71717a;font-size:13px;padding:4px 0;width:140px;">Datum</td>
        <td style="color:#1a1a1a;font-size:14px;font-weight:500;padding:4px 0;">${formattedDate}</td>
      </tr>
      <tr>
        <td style="color:#71717a;font-size:13px;padding:4px 0;width:140px;">Abhol-Zeit</td>
        <td style="color:#dc2626;font-size:18px;font-weight:700;padding:4px 0;">${pickupTime}</td>
      </tr>
      ${appointmentRow}
      <tr>
        <td style="color:#71717a;font-size:13px;padding:4px 0;width:140px;">Richtung</td>
        <td style="color:#1a1a1a;font-size:14px;font-weight:500;padding:4px 0;">${directionLabel}</td>
      </tr>
      ${returnRow}
      <tr>
        <td style="color:#71717a;font-size:13px;padding:4px 0;width:140px;">Status</td>
        <td style="color:#1a1a1a;font-size:14px;font-weight:500;padding:4px 0;">${statusLabel}</td>
      </tr>
    </table>
  </td>
</tr>`
}
