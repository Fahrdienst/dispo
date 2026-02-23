import type { OrderSheetData } from "@/lib/mail/load-order-sheet-data"
import { escapeHtml, formatCHF } from "@/lib/mail/utils"

/**
 * Render a single label-value row for the cost summary block.
 * Returns empty string if value is null/undefined/empty.
 */
function row(label: string, value: string | null | undefined): string {
  if (!value) return ""
  return `<tr>
    <td style="color:#71717a;font-size:13px;padding:4px 0;width:140px;">${label}</td>
    <td style="color:#1a1a1a;font-size:14px;font-weight:500;padding:4px 0;">${escapeHtml(value)}</td>
  </tr>`
}

/**
 * Render the cost summary section of the order sheet email.
 * Shows distance (if available) and effective price.
 * Marks manually overridden prices with "(manuell)".
 * If no price is available, shows "Kosten: -".
 */
export function renderCostSummary(data: OrderSheetData): string {
  // Distance in km (optional)
  const distanceStr = data.distanceKm !== null ? `${data.distanceKm} km` : null

  // Price display
  let priceDisplay: string
  if (data.effectivePrice !== null) {
    const formatted = formatCHF(data.effectivePrice)
    priceDisplay = data.isPriceOverride ? `${formatted} (manuell)` : formatted
  } else {
    priceDisplay = "\u2013" // en-dash
  }

  return `<!-- Cost Summary -->
<tr>
  <td style="padding:0 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e7eb;">
      <tr>
        <td style="background-color:#f3f4f6;padding:8px 12px;font-size:14px;font-weight:600;color:#1a1a1a;">Kosten</td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:12px 0;">
      ${row("Distanz", distanceStr)}
      <tr>
        <td style="color:#71717a;font-size:13px;padding:4px 0;width:140px;">Fahrpreis</td>
        <td style="color:#1a1a1a;font-size:16px;font-weight:600;padding:4px 0;">${escapeHtml(priceDisplay)}</td>
      </tr>
    </table>
  </td>
</tr>`
}
