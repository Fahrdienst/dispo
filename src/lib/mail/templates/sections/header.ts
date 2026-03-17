import type { OrderSheetData } from "@/lib/mail/load-order-sheet-data"
import { escapeHtml, formatCHF, formatDate, formatTime } from "@/lib/mail/utils"
import {
  RIDE_DIRECTION_LABELS,
  RIDE_STATUS_LABELS,
} from "@/lib/rides/constants"

/**
 * Generate the short order reference number.
 * Format: F-YYMMDD-last4 (e.g. F-260225-a3f1)
 */
function formatOrderRef(date: string, rideId: string): string {
  const parts = date.split("-")
  const yy = (parts[0] ?? "").slice(2)
  const mm = parts[1] ?? ""
  const dd = parts[2] ?? ""
  const last4 = rideId.slice(-4)
  return `F-${yy}${mm}${dd}-${last4}`
}

/**
 * Determine the ride type indicator text.
 * "both" direction means round trip; otherwise single trip.
 */
function getRideTypeLabel(direction: string): string {
  if (direction === "both") return "Hin- und R\u00fcckfahrt"
  return RIDE_DIRECTION_LABELS[direction as keyof typeof RIDE_DIRECTION_LABELS] ?? direction
}

/**
 * Render the header section of the order sheet email.
 *
 * Layout:
 * - Dark slate header bar with organization name
 * - Order reference and date line
 * - Two-column overview table:
 *   Left: Auftrags-Typ, Auftraggeber, Auftrags-Status
 *   Right: Abhol-Zeit (red, large), Termin, Rueckfahrt ca., Auftrags-Kosten
 * - Round-trip indicator badge (if direction === "both")
 */
export function renderHeader(data: OrderSheetData): string {
  const orderRef = formatOrderRef(data.date, data.rideId)
  const formattedDate = escapeHtml(formatDate(data.date))
  const pickupTime = escapeHtml(formatTime(data.pickupTime))
  const orgName = escapeHtml(data.organizationName)

  const directionLabel = escapeHtml(
    RIDE_DIRECTION_LABELS[data.direction as keyof typeof RIDE_DIRECTION_LABELS] ??
      data.direction
  )
  const statusLabel = escapeHtml(
    RIDE_STATUS_LABELS[data.status as keyof typeof RIDE_STATUS_LABELS] ??
      data.status
  )
  const rideTypeLabel = escapeHtml(getRideTypeLabel(data.direction))

  // Right column: optional rows
  const appointmentRow = data.appointmentTime
    ? `<tr>
        <td style="color:#71717a;font-size:13px;padding:4px 0;">Termin</td>
        <td style="color:#1a1a1a;font-size:14px;font-weight:500;padding:4px 0;text-align:right;">${escapeHtml(formatTime(data.appointmentTime))}</td>
      </tr>`
    : ""

  const returnRow = data.returnPickupTime
    ? `<tr>
        <td style="color:#71717a;font-size:13px;padding:4px 0;">R&uuml;ckfahrt ca.</td>
        <td style="color:#1a1a1a;font-size:14px;font-weight:500;padding:4px 0;text-align:right;">${escapeHtml(formatTime(data.returnPickupTime))}</td>
      </tr>`
    : ""

  // Cost display
  let costDisplay: string
  if (data.effectivePrice !== null) {
    costDisplay = escapeHtml(formatCHF(data.effectivePrice))
  } else {
    costDisplay = "&ndash;"
  }

  // Round-trip badge (only for "both" direction)
  const roundTripBadge = data.direction === "both"
    ? `<tr>
        <td colspan="2" style="padding:12px 0 0;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="background-color:#dbeafe;color:#1e40af;font-size:12px;font-weight:600;padding:4px 12px;border-radius:4px;letter-spacing:0.02em;">&#x21C4; Hin- und R&uuml;ckfahrt</td>
            </tr>
          </table>
        </td>
      </tr>`
    : ""

  return `<!-- Header Bar -->
<tr>
  <td class="header-bar" style="background-color:#1e293b;padding:24px 32px;">
    <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.01em;font-family:Arial,Helvetica,sans-serif;">${orgName}</h1>
    <p style="margin:6px 0 0;color:#94a3b8;font-size:13px;font-family:Arial,Helvetica,sans-serif;">Fahrauftrag</p>
  </td>
</tr>

<!-- Order Reference & Date -->
<tr>
  <td style="padding:20px 32px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="font-family:Arial,Helvetica,sans-serif;">
          <span style="color:#1e293b;font-size:16px;font-weight:700;">${escapeHtml(orderRef)}</span>
          <span style="color:#94a3b8;font-size:14px;padding-left:12px;">${formattedDate}</span>
        </td>
      </tr>
    </table>
  </td>
</tr>

<!-- Two-Column Order Overview -->
<tr>
  <td style="padding:16px 32px 20px;">
    <!--[if mso]>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td width="280" valign="top">
    <![endif]-->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td class="col-left" style="width:50%;vertical-align:top;padding-right:16px;" valign="top">
          <!-- Left Column: Order Details -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,Helvetica,sans-serif;">
            <tr>
              <td style="color:#71717a;font-size:13px;padding:4px 0;">Auftrags-Typ</td>
              <td style="color:#1a1a1a;font-size:14px;font-weight:500;padding:4px 0;">${rideTypeLabel}</td>
            </tr>
            <tr>
              <td style="color:#71717a;font-size:13px;padding:4px 0;">Auftraggeber</td>
              <td style="color:#1a1a1a;font-size:14px;font-weight:500;padding:4px 0;">${orgName}</td>
            </tr>
            <tr>
              <td style="color:#71717a;font-size:13px;padding:4px 0;">Richtung</td>
              <td style="color:#1a1a1a;font-size:14px;font-weight:500;padding:4px 0;">${directionLabel}</td>
            </tr>
            <tr>
              <td style="color:#71717a;font-size:13px;padding:4px 0;">Status</td>
              <td style="color:#1a1a1a;font-size:14px;font-weight:500;padding:4px 0;">${statusLabel}</td>
            </tr>
          </table>
        </td>
        <td class="col-right" style="width:50%;vertical-align:top;padding-left:16px;border-left:1px solid #e5e7eb;" valign="top">
          <!-- Right Column: Times & Cost -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,Helvetica,sans-serif;">
            <tr>
              <td style="color:#71717a;font-size:13px;padding:4px 0;">Abhol-Zeit</td>
              <td style="color:#dc2626;font-size:22px;font-weight:700;padding:4px 0;text-align:right;line-height:1.2;">${pickupTime}</td>
            </tr>
            ${appointmentRow}
            ${returnRow}
            <tr>
              <td style="color:#71717a;font-size:13px;padding:4px 0;">Kosten</td>
              <td style="color:#1a1a1a;font-size:14px;font-weight:600;padding:4px 0;text-align:right;">${costDisplay}</td>
            </tr>
          </table>
        </td>
      </tr>
      ${roundTripBadge}
    </table>
    <!--[if mso]>
    </td></tr></table>
    <![endif]-->
  </td>
</tr>`
}
