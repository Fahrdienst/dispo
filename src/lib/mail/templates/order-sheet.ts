import type { OrderSheetData } from "@/lib/mail/load-order-sheet-data"
import { escapeHtml, formatCHF, formatDate } from "@/lib/mail/utils"
import { renderHeader } from "./sections/header"
import { renderPatientBlock } from "./sections/patient-block"
import { renderDestinationBlock } from "./sections/destination-block"
import { renderDriverBlock } from "./sections/driver-block"

/**
 * Assemble the complete order sheet HTML email from section renderers.
 * Produces a self-contained HTML document with inline styles,
 * table-based layout (600px max), and print-friendly @media rules.
 */
export function assembleOrderSheet(data: OrderSheetData): string {
  const formattedDate = escapeHtml(formatDate(data.date))

  // Cost summary (only if effective price exists)
  const costSection = data.effectivePrice !== null
    ? `<!-- Cost Summary -->
<tr>
  <td style="padding:0 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e7eb;">
      <tr>
        <td style="background-color:#f3f4f6;padding:8px 12px;font-size:14px;font-weight:600;color:#1a1a1a;">Kosten</td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:12px 0;">
      <tr>
        <td style="color:#71717a;font-size:13px;padding:4px 0;width:140px;">Fahrpreis${data.isPriceOverride ? " (manuell)" : ""}</td>
        <td style="color:#1a1a1a;font-size:16px;font-weight:600;padding:4px 0;">${escapeHtml(formatCHF(data.effectivePrice))}</td>
      </tr>
    </table>
  </td>
</tr>`
    : ""

  // Action buttons placeholder (Phase 3)
  const actionButtonsPlaceholder = `<!-- Action Buttons (Phase 3) -->
<tr>
  <td style="padding:16px 32px;">
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
</tr>`

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Fahrauftrag - Patienten-Fahrdienst D&uuml;bendorf</title>
  <style type="text/css">
    @media print {
      body { background-color: #ffffff !important; }
      .email-wrapper { padding: 0 !important; }
      .email-container { box-shadow: none !important; border-radius: 0 !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f8f8f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-wrapper" style="background-color:#f8f8f8;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-container" style="max-width:600px;background-color:#ffffff;border-radius:8px;overflow:hidden;">
          ${renderHeader(data)}
          ${renderPatientBlock(data)}
          ${renderDestinationBlock(data)}
          ${renderDriverBlock(data)}
          ${costSection}
          ${actionButtonsPlaceholder}

          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #e5e7eb;background-color:#f8f8f8;">
              <p style="margin:0;color:#a1a1aa;font-size:12px;text-align:center;">
                Patienten-Fahrdienst D&uuml;bendorf &middot; ${formattedDate}
              </p>
              <p style="margin:4px 0 0;color:#a1a1aa;font-size:11px;text-align:center;">
                Dieser Link ist 48 Stunden g&uuml;ltig und kann nur einmal verwendet werden.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
