import "server-only"
import { renderToBuffer } from "@react-pdf/renderer"
import { createAdminClient } from "@/lib/supabase/admin"
import { ReceiptDocument } from "@/lib/receipts/pdf-document"
import type { ReceiptPdfData, ReceiptPdfItem } from "@/lib/receipts/types"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/types/database"

/** Private storage bucket for receipt PDFs (created in migration 20260718). */
const RECEIPTS_BUCKET = "receipts"
/** Public bucket holding the organization logo (migration 20260316). */
const ORGANIZATION_BUCKET = "organization"

type AdminClient = SupabaseClient<Database>

/** Map a file extension to an @react-pdf embeddable image mime type. */
function embeddableMime(fileName: string): string | null {
  const ext = fileName.split(".").pop()?.toLowerCase()
  switch (ext) {
    case "png":
      return "image/png"
    case "jpg":
    case "jpeg":
      return "image/jpeg"
    // @react-pdf Image supports only PNG/JPEG. SVG/WebP are intentionally
    // skipped (rendered without a logo) rather than crashing the PDF.
    default:
      return null
  }
}

/**
 * Load the organization logo as a base64 data-URI from the (public) organization
 * bucket. Server-side embed, no external fetch (ADR-015 E6). Returns null when
 * there is no logo, the format is not embeddable, or the download fails — the
 * receipt PDF is still produced, just without a logo.
 */
async function loadLogoDataUri(
  supabase: AdminClient,
  logoUrl: string | null
): Promise<string | null> {
  if (!logoUrl) return null

  let fileName: string
  try {
    const parts = new URL(logoUrl).pathname.split("/")
    fileName = parts[parts.length - 1] ?? ""
  } catch {
    fileName = logoUrl.split("/").pop() ?? ""
  }
  if (!fileName) return null

  const mime = embeddableMime(fileName)
  if (!mime) return null

  const { data, error } = await supabase.storage
    .from(ORGANIZATION_BUCKET)
    .download(fileName)
  if (error || !data) return null

  const buffer = Buffer.from(await data.arrayBuffer())
  return `data:${mime};base64,${buffer.toString("base64")}`
}

/** Derive the storage year from a receipt number "Q-2026-00042" (fallback: issued_at). */
function receiptYear(receiptNumber: string, issuedAt: string): string {
  const fromNumber = receiptNumber.split("-")[1]
  if (fromNumber && /^\d{4}$/.test(fromNumber)) return fromNumber
  return String(new Date(issuedAt).getFullYear())
}

/**
 * Render a receipt PDF from its immutable snapshot, upload it to the private
 * `receipts` bucket at `<year>/<receipt_number>.pdf` (SEC-M14-012: no PII in the
 * path), and set `receipts.pdf_path`.
 *
 * Runs AFTER the DB transaction (ADR-015 E5) using the service-role client, so
 * it bypasses RLS while the immutability triggers still permit the `pdf_path`
 * change. Fully idempotent: re-running overwrites the same object and re-sets
 * `pdf_path` (used by the "PDF neu erzeugen" retry when a receipt exists with
 * `pdf_path = NULL`).
 *
 * @throws when the receipt is missing, rendering fails, or the upload fails —
 *         the caller decides how to surface it (the receipt itself stays valid).
 */
export async function generateAndStoreReceiptPdf(
  receiptId: string
): Promise<{ pdfPath: string }> {
  const supabase = createAdminClient()

  // 1. Load the receipt head.
  const { data: receipt, error: receiptError } = await supabase
    .from("receipts")
    .select("*")
    .eq("id", receiptId)
    .single()
  if (receiptError || !receipt) {
    throw new Error(
      `Beleg ${receiptId} konnte nicht geladen werden: ${receiptError?.message ?? "nicht gefunden"}`
    )
  }

  // 2. Load positions (immutable snapshot).
  const { data: itemRows, error: itemsError } = await supabase
    .from("receipt_items")
    .select("ride_date, description, distance_km, amount")
    .eq("receipt_id", receiptId)
    .order("ride_date")
  if (itemsError) {
    throw new Error(
      `Positionen des Belegs ${receiptId} konnten nicht geladen werden: ${itemsError.message}`
    )
  }

  // 3. Organization letterhead.
  const { data: org } = await supabase
    .from("organization_settings")
    .select(
      "org_name, org_street, org_postal_code, org_city, org_phone, org_email, logo_url"
    )
    .limit(1)
    .single()

  // 4. Issuing person's display name.
  const { data: issuer } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", receipt.issued_by)
    .single()

  // 5. Logo (best effort).
  const logoDataUri = await loadLogoDataUri(supabase, org?.logo_url ?? null)

  const items: ReceiptPdfItem[] = (itemRows ?? []).map((row) => ({
    rideDate: row.ride_date,
    description: row.description,
    distanceKm: row.distance_km,
    amount: row.amount,
  }))

  const data: ReceiptPdfData = {
    receiptNumber: receipt.receipt_number,
    recipientName: receipt.recipient_name,
    recipientAddress: receipt.recipient_address,
    periodFrom: receipt.period_from,
    periodTo: receipt.period_to,
    totalAmount: receipt.total_amount,
    currency: receipt.currency,
    issuedAt: receipt.issued_at,
    issuedByName: issuer?.display_name ?? "—",
    status: receipt.status,
    cancelledReason: receipt.cancelled_reason,
    items,
    org: {
      name: org?.org_name ?? "Fahrdienst",
      street: org?.org_street ?? null,
      postalCode: org?.org_postal_code ?? null,
      city: org?.org_city ?? null,
      phone: org?.org_phone ?? null,
      email: org?.org_email ?? null,
    },
    logoDataUri,
  }

  // 6. Render to a PDF buffer (Node runtime).
  const buffer = await renderToBuffer(ReceiptDocument({ data }))

  // 7. Upload to the private bucket (overwrite for idempotency).
  const year = receiptYear(receipt.receipt_number, receipt.issued_at)
  const pdfPath = `${year}/${receipt.receipt_number}.pdf`
  const { error: uploadError } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .upload(pdfPath, buffer, {
      upsert: true,
      contentType: "application/pdf",
    })
  if (uploadError) {
    throw new Error(`PDF-Upload fehlgeschlagen: ${uploadError.message}`)
  }

  // 8. Persist the path (immutability trigger permits pdf_path changes).
  const { error: updateError } = await supabase
    .from("receipts")
    .update({ pdf_path: pdfPath })
    .eq("id", receiptId)
  if (updateError) {
    throw new Error(`pdf_path konnte nicht gesetzt werden: ${updateError.message}`)
  }

  return { pdfPath }
}
