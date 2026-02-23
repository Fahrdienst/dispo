import type { OrderSheetData } from "@/lib/mail/load-order-sheet-data"

/**
 * Render the action buttons section of the order sheet email.
 * Two buttons side-by-side: "Annehmen" (solid green) and "Ablehnen" (outline red).
 * Table-based layout for email client compatibility. Mobile-optimised touch targets.
 * Returns empty string if confirmUrl or rejectUrl is missing.
 */
export function renderActionButtons(data: OrderSheetData): string {
  if (!data.confirmUrl || !data.rejectUrl) {
    return ""
  }

  return `<!-- Action Buttons -->
<tr>
  <td style="padding:24px 32px 8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" width="50%" style="padding-right:8px;" valign="top">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="background-color:#16a34a;border-radius:6px;">
                <a href="${data.confirmUrl}" target="_blank" style="display:inline-block;min-width:160px;min-height:44px;line-height:44px;background-color:#16a34a;color:#ffffff;text-decoration:none;padding:0 24px;border-radius:6px;font-size:14px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center;">
                  Annehmen
                </a>
              </td>
            </tr>
          </table>
        </td>
        <td align="center" width="50%" style="padding-left:8px;" valign="top">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="border:2px solid #ef4444;border-radius:6px;">
                <a href="${data.rejectUrl}" target="_blank" style="display:inline-block;min-width:160px;min-height:44px;line-height:40px;color:#b91c1c;text-decoration:none;padding:0 24px;border-radius:6px;font-size:14px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center;">
                  Ablehnen
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </td>
</tr>
<tr>
  <td style="padding:12px 32px 8px;">
    <p style="margin:0;color:#a1a1aa;font-size:12px;text-align:center;">
      Dieser Link ist 48 Stunden g&uuml;ltig und kann nur einmal verwendet werden.
    </p>
  </td>
</tr>`
}
