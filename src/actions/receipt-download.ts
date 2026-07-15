"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAuth } from "@/lib/auth/require-auth"
import type { ActionResult } from "@/actions/shared"

// Private receipts bucket (Migration 20260718, SEC-M14-005/007/012).
const RECEIPTS_BUCKET = "receipts"

/**
 * TTL for receipt-PDF signed URLs.
 *
 * SEC-M14-005 (HIGH): receipt PDFs are downloaded on-demand inside an
 * authenticated session, so the URL must be short-lived. This deliberately does
 * NOT reuse the 1-year `feedback` pattern (that URL is embedded in a GitHub
 * issue). Hard ceiling: 5 minutes.
 */
export const RECEIPT_SIGNED_URL_TTL_SECONDS = 300

/**
 * Produce a short-lived signed download URL for a receipt PDF.
 *
 * Access: admin + operator only. Never returns a public URL. The URL is minted
 * fresh per call with a ≤ 5 min TTL (SEC-M14-005). If the PDF has not been
 * generated yet (`pdf_path IS NULL`), a friendly error is returned so the UI
 * can show a hint instead of a broken download.
 */
export async function getReceiptDownloadUrl(
  receiptId: string
): Promise<ActionResult<{ url: string; filename: string }>> {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  if (!receiptId) {
    return { success: false, error: "Ungültige Anfrage." }
  }

  // Read via the RLS-scoped session client so a non-staff caller can never
  // enumerate receipts even if they reach this action.
  const supabase = await createClient()
  const { data: receipt, error } = await supabase
    .from("receipts")
    .select("receipt_number, pdf_path")
    .eq("id", receiptId)
    .single()

  if (error || !receipt) {
    return { success: false, error: "Beleg nicht gefunden." }
  }

  if (!receipt.pdf_path) {
    return {
      success: false,
      error: "Für diesen Beleg wurde noch kein PDF erzeugt.",
    }
  }

  // Sign with the service-role client (the bucket is default-deny for
  // authenticated). TTL is hard-capped at 5 minutes.
  const admin = createAdminClient()
  const { data: signed, error: signError } = await admin.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrl(receipt.pdf_path, RECEIPT_SIGNED_URL_TTL_SECONDS)

  if (signError || !signed?.signedUrl) {
    console.error("[receipt-download] signing failed:", signError?.message)
    return {
      success: false,
      error: "Der Download-Link konnte nicht erstellt werden.",
    }
  }

  return {
    success: true,
    data: {
      url: signed.signedUrl,
      filename: `${receipt.receipt_number}.pdf`,
    },
  }
}
