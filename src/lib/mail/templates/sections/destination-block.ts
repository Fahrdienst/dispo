import type { OrderSheetData } from "@/lib/mail/load-order-sheet-data"
import { escapeHtml } from "@/lib/mail/utils"
import { FACILITY_TYPE_LABELS } from "@/lib/rides/constants"

/**
 * Render a single label-value row for the destination block.
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
 * Render the destination section of the order sheet email.
 * Shows destination name, type, address, phone, contact person,
 * department, distance, and comment. Null fields are omitted.
 */
export function renderDestinationBlock(data: OrderSheetData): string {
  // Facility type label
  const facilityLabel = data.destinationFacilityType
    ? (FACILITY_TYPE_LABELS[
        data.destinationFacilityType as keyof typeof FACILITY_TYPE_LABELS
      ] ?? data.destinationFacilityType)
    : null

  // Address line
  const addressLine =
    data.destinationStreet && data.destinationHouseNumber
      ? `${data.destinationStreet} ${data.destinationHouseNumber}`
      : data.destinationStreet ?? data.destinationHouseNumber ?? null

  // PLZ/Ort
  const plzOrt =
    data.destinationPostalCode && data.destinationCity
      ? `${data.destinationPostalCode} ${data.destinationCity}`
      : data.destinationPostalCode ?? data.destinationCity ?? null

  // Contact person: combine first + last name
  const contactParts: string[] = []
  if (data.destinationContactFirstName) contactParts.push(data.destinationContactFirstName)
  if (data.destinationContactLastName) contactParts.push(data.destinationContactLastName)
  const contactPerson = contactParts.length > 0 ? contactParts.join(" ") : null

  // Distance in km
  const distanceStr = data.distanceKm !== null ? `${data.distanceKm} km` : null

  return `<!-- Destination Block -->
<tr>
  <td style="padding:0 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e7eb;">
      <tr>
        <td style="background-color:#f3f4f6;padding:8px 12px;font-size:14px;font-weight:600;color:#1a1a1a;">Ziel</td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:12px 0;">
      ${row("Name", data.destinationName)}
      ${row("Art", facilityLabel)}
      ${row("Adresse", addressLine)}
      ${row("PLZ / Ort", plzOrt)}
      ${row("Telefon", data.destinationPhone)}
      ${row("Kontaktperson", contactPerson)}
      ${row("Abteilung", data.destinationDepartment)}
      ${row("Distanz", distanceStr)}
      ${row("Bemerkungen", data.destinationComment)}
    </table>
  </td>
</tr>`
}
