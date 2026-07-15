"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/require-auth"
import { getBillableRides } from "@/lib/receipts/queries"
import { generateAndStoreReceiptPdf } from "@/lib/receipts/pdf-service"
import type { ActionResult } from "@/actions/shared"
import type { BillableRide } from "@/lib/receipts/types"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// =============================================================================
// LOAD BILLABLE RIDES (preview)
// =============================================================================

const loadSchema = z.object({
  patientId: z.string().uuid(),
  from: z.string().regex(DATE_RE),
  to: z.string().regex(DATE_RE),
})

/**
 * Server action used by the create form to (re)load the billable-ride preview
 * whenever the patient or period changes. Auth-gated to admin/operator.
 */
export async function loadBillableRides(input: {
  patientId: string
  from: string
  to: string
}): Promise<ActionResult<BillableRide[]>> {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const parsed = loadSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: "Ungültige Eingabe" }
  }
  if (parsed.data.to < parsed.data.from) {
    return { success: false, error: "Das End-Datum liegt vor dem Start-Datum" }
  }

  const rides = await getBillableRides(
    parsed.data.patientId,
    parsed.data.from,
    parsed.data.to
  )
  return { success: true, data: rides }
}

// =============================================================================
// ISSUE RECEIPT
// =============================================================================

const issueSchema = z.object({
  patientId: z.string().uuid(),
  from: z.string().regex(DATE_RE),
  to: z.string().regex(DATE_RE),
  rideIds: z.array(z.string().uuid()).min(1),
})

export interface IssueReceiptResult {
  receiptId: string
  receiptNumber: string
  /** True when the PDF was generated & stored; false means retry is needed. */
  pdfGenerated: boolean
}

/**
 * Issue a receipt: draw the number, write the snapshot (receipts + items) and
 * the audit entry — all atomically in the `issue_receipt` RPC (ADR-015 E5).
 * The PDF is generated AFTERWARDS, outside the DB transaction; if it fails the
 * receipt still exists with `pdf_path = NULL` and the caller is told via a
 * non-blocking warning (no rollback).
 */
export async function issueReceipt(input: {
  patientId: string
  from: string
  to: string
  rideIds: string[]
}): Promise<ActionResult<IssueReceiptResult>> {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const parsed = issueSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: "Bitte mindestens eine Fahrt auswählen" }
  }
  if (parsed.data.to < parsed.data.from) {
    return { success: false, error: "Das End-Datum liegt vor dem Start-Datum" }
  }

  // Call the RPC through the user-scoped client so auth.uid() (issued_by) is set.
  const supabase = await createClient()
  const { data: receipt, error } = await supabase.rpc("issue_receipt", {
    p_patient_id: parsed.data.patientId,
    p_period_from: parsed.data.from,
    p_period_to: parsed.data.to,
    p_ride_ids: parsed.data.rideIds,
  })

  if (error || !receipt) {
    return {
      success: false,
      error: error?.message ?? "Die Quittung konnte nicht ausgestellt werden",
    }
  }

  revalidatePath("/finance/receipts")

  // Generate the PDF after the transaction. A failure here is non-blocking.
  let pdfGenerated = true
  try {
    await generateAndStoreReceiptPdf(receipt.id)
  } catch (pdfError) {
    pdfGenerated = false
    console.error(
      `PDF generation failed for receipt ${receipt.id}:`,
      pdfError instanceof Error ? pdfError.message : pdfError
    )
  }

  return {
    success: true,
    data: {
      receiptId: receipt.id,
      receiptNumber: receipt.receipt_number,
      pdfGenerated,
    },
    warnings: pdfGenerated
      ? undefined
      : [
          {
            code: "receipt_pdf_failed",
            message:
              "Die Quittung wurde ausgestellt, aber das PDF konnte nicht erzeugt werden. Es kann später neu erzeugt werden.",
          },
        ],
  }
}

// =============================================================================
// REGENERATE PDF (idempotent retry)
// =============================================================================

/**
 * Idempotently (re)generate and store the PDF for an existing receipt — used
 * when a receipt exists with `pdf_path = NULL` after a failed first attempt.
 */
export async function regenerateReceiptPdf(
  receiptId: string
): Promise<ActionResult<{ pdfPath: string }>> {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const parsed = z.string().uuid().safeParse(receiptId)
  if (!parsed.success) {
    return { success: false, error: "Ungültige Beleg-ID" }
  }

  try {
    const { pdfPath } = await generateAndStoreReceiptPdf(parsed.data)
    revalidatePath("/finance/receipts")
    return { success: true, data: { pdfPath } }
  } catch (pdfError) {
    console.error(
      `PDF regeneration failed for receipt ${receiptId}:`,
      pdfError instanceof Error ? pdfError.message : pdfError
    )
    return {
      success: false,
      error: "Das PDF konnte nicht erzeugt werden. Bitte später erneut versuchen.",
    }
  }
}
