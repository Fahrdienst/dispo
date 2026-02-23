import type { OrderSheetData } from "@/lib/mail/load-order-sheet-data"
import { escapeHtml, formatDate } from "@/lib/mail/utils"
import { renderHeader } from "./sections/header"
import { renderPatientBlock } from "./sections/patient-block"
import { renderDestinationBlock } from "./sections/destination-block"
import { renderDriverBlock } from "./sections/driver-block"
import { renderCostSummary } from "./sections/cost-summary"
import { renderActionButtons } from "./sections/action-buttons"

/**
 * Assemble the complete order sheet HTML email from section renderers.
 * Produces a self-contained HTML document with inline styles,
 * table-based layout (600px max), and print-friendly @media rules.
 */
export function assembleOrderSheet(data: OrderSheetData): string {
  const formattedDate = escapeHtml(formatDate(data.date))

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
          ${renderCostSummary(data)}
          ${renderActionButtons(data)}

          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #e5e7eb;background-color:#f8f8f8;">
              <p style="margin:0;color:#a1a1aa;font-size:12px;text-align:center;">
                Patienten-Fahrdienst D&uuml;bendorf &middot; ${formattedDate}
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
