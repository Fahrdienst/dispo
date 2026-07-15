import type { Enums } from "@/lib/types/database"

/**
 * A completed, not-yet-actively-receipted ride shown in the receipt create
 * preview. `amount` is the effective price (`price_override ?? calculated_price`);
 * `null` means the ride has no price yet and MUST NOT be selectable (concept 3.1).
 */
export interface BillableRide {
  id: string
  /** YYYY-MM-DD */
  date: string
  direction: Enums<"ride_direction">
  distanceKm: number | null
  amount: number | null
  /** "<Ort> → <Ziel> (<Richtung>)" — mirrors the RPC snapshot exactly. */
  description: string
}

/** Organization letterhead data for the PDF (subset of organization_settings). */
export interface ReceiptOrg {
  name: string
  street: string | null
  postalCode: string | null
  city: string | null
  phone: string | null
  email: string | null
}

/** A single frozen position rendered in the PDF table. */
export interface ReceiptPdfItem {
  /** YYYY-MM-DD */
  rideDate: string
  description: string
  distanceKm: number | null
  amount: number
}

/** Fully denormalized snapshot needed to render a receipt PDF (no further I/O). */
export interface ReceiptPdfData {
  receiptNumber: string
  recipientName: string
  recipientAddress: string
  /** YYYY-MM-DD */
  periodFrom: string
  /** YYYY-MM-DD */
  periodTo: string
  totalAmount: number
  currency: string
  /** ISO timestamp */
  issuedAt: string
  issuedByName: string
  status: Enums<"receipt_status">
  cancelledReason: string | null
  items: ReceiptPdfItem[]
  org: ReceiptOrg
  /** Data-URI (png/jpg) of the org logo, or null if none/embeddable. */
  logoDataUri: string | null
}
