import type { OrderSheetData } from "@/lib/mail/load-order-sheet-data"
import { escapeHtml } from "@/lib/mail/utils"
import { VEHICLE_TYPE_LABELS } from "@/lib/rides/constants"

/**
 * Render a single label-value row for the driver block.
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
 * Render the driver section of the order sheet email.
 * Shows driver name, address, phone, email, vehicle type.
 * Optionally includes ride notes as a separate "Hinweise" sub-section.
 * Null fields are omitted.
 */
export function renderDriverBlock(data: OrderSheetData): string {
  const fullName = `${data.driverFirstName} ${data.driverLastName}`

  // Address line
  const addressLine =
    data.driverStreet && data.driverHouseNumber
      ? `${data.driverStreet} ${data.driverHouseNumber}`
      : data.driverStreet ?? data.driverHouseNumber ?? null

  // PLZ/Ort
  const plzOrt =
    data.driverPostalCode && data.driverCity
      ? `${data.driverPostalCode} ${data.driverCity}`
      : data.driverPostalCode ?? data.driverCity ?? null

  // Vehicle type label
  const vehicleLabel =
    VEHICLE_TYPE_LABELS[
      data.driverVehicleType as keyof typeof VEHICLE_TYPE_LABELS
    ] ?? data.driverVehicleType

  // Notes section (ride-level notes, rendered as a separate sub-block)
  const notesSection = data.notes
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e7eb;margin-top:8px;">
      <tr>
        <td style="background-color:#fef3c7;padding:8px 12px;font-size:13px;font-weight:600;color:#92400e;">Hinweise</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;font-size:14px;color:#1a1a1a;">${escapeHtml(data.notes)}</td>
      </tr>
    </table>`
    : ""

  return `<!-- Driver Block -->
<tr>
  <td style="padding:0 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e7eb;">
      <tr>
        <td style="background-color:#f3f4f6;padding:8px 12px;font-size:14px;font-weight:600;color:#1a1a1a;">Fahrer</td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:12px 0;">
      ${row("Name", fullName)}
      ${row("Adresse", addressLine)}
      ${row("PLZ / Ort", plzOrt)}
      ${row("Telefon / Mobile", data.driverPhone)}
      ${row("E-Mail", data.driverEmail)}
      ${row("Fahrzeugtyp", vehicleLabel)}
    </table>
    ${notesSection}
  </td>
</tr>`
}
