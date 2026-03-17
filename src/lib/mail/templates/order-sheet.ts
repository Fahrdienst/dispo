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
 * table-based layout (600px max), print-friendly @media rules,
 * and basic responsive support for mobile clients.
 */
export function assembleOrderSheet(data: OrderSheetData): string {
  const formattedDate = escapeHtml(formatDate(data.date))

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Fahrauftrag - ${escapeHtml(data.organizationName)}</title>
  <style type="text/css">
    /* Mobile: stack columns on small screens */
    @media only screen and (max-width: 480px) {
      .col-left, .col-right {
        display: block !important;
        width: 100% !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
        border-left: none !important;
      }
      .col-right {
        padding-top: 12px !important;
        margin-top: 12px !important;
        border-top: 1px solid #e5e7eb !important;
      }
      .email-container {
        width: 100% !important;
      }
    }
    /* Print: clean output for drivers printing from email client */
    @media print {
      body { background-color: #ffffff !important; margin: 0 !important; }
      .email-wrapper { padding: 0 !important; background-color: #ffffff !important; }
      .email-container { box-shadow: none !important; border-radius: 0 !important; max-width: 100% !important; }
      /* Hide action buttons in print — not useful on paper */
      .action-buttons { display: none !important; }
      /* Ensure dark header prints correctly */
      .header-bar { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-wrapper" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-container" style="max-width:600px;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          ${renderHeader(data)}
          ${renderPatientBlock(data)}
          ${renderDestinationBlock(data)}
          ${renderDriverBlock(data)}
          ${renderCostSummary(data)}
          ${renderActionButtons(data)}

          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #e5e7eb;background-color:#f8fafc;">
              <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;font-family:Arial,Helvetica,sans-serif;">
                ${escapeHtml(data.organizationName)} &middot; ${formattedDate}
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
