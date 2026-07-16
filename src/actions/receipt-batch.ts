"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/require-auth"
import { logAudit } from "@/lib/audit/logger"
import { getBatchCandidates, type BatchCandidate } from "@/lib/receipts/batch-queries"
import { generateAndStoreReceiptPdf } from "@/lib/receipts/pdf-service"
import { sendReceiptMail } from "@/lib/mail/receipt-mail"
import { runReceiptBatch, type BatchRunItem, type BatchRunResult } from "@/lib/receipts/batch-runner"
import type { ActionResult } from "@/actions/shared"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// =============================================================================
// LOAD BATCH CANDIDATES (preview)
// =============================================================================

const rangeSchema = z.object({
  from: z.string().regex(DATE_RE),
  to: z.string().regex(DATE_RE),
})

/**
 * Load all patients with billable rides in the given period for the batch-run
 * preview. Auth-gated to admin/operator.
 */
export async function loadBatchCandidates(input: {
  from: string
  to: string
}): Promise<ActionResult<BatchCandidate[]>> {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const parsed = rangeSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: "Ungültiger Zeitraum" }
  }
  if (parsed.data.to < parsed.data.from) {
    return { success: false, error: "Das End-Datum liegt vor dem Start-Datum" }
  }

  const candidates = await getBatchCandidates(parsed.data.from, parsed.data.to)
  return { success: true, data: candidates }
}

// =============================================================================
// EXECUTE BATCH RUN
// =============================================================================

const executeSchema = z.object({
  from: z.string().regex(DATE_RE),
  to: z.string().regex(DATE_RE),
  patientIds: z.array(z.string().uuid()).min(1),
  sendEmail: z.boolean(),
})

export type BatchRunResponse = BatchRunResult

/**
 * Execute a batch run (concept 4.2). For robustness and to avoid trusting stale
 * client data, the billable ride ids are re-derived server-side from the current
 * candidates and intersected with the operator's patient selection — the client
 * only supplies which patients to run and whether to also e-mail.
 *
 * Each patient is issued in its own transaction via the `issue_receipt` RPC; a
 * failure for one patient does not stop the others (partial-result report). One
 * run-level audit entry is added on top of the per-receipt entries the RPC
 * already writes (SEC-M14-006).
 */
export async function executeReceiptBatch(input: {
  from: string
  to: string
  patientIds: string[]
  sendEmail: boolean
}): Promise<ActionResult<BatchRunResponse>> {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const parsed = executeSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: "Bitte mindestens einen Patienten auswählen" }
  }
  if (parsed.data.to < parsed.data.from) {
    return { success: false, error: "Das End-Datum liegt vor dem Start-Datum" }
  }

  const { from, to, patientIds, sendEmail } = parsed.data

  // Re-derive candidates fresh; never trust client-provided ride ids.
  const candidates = await getBatchCandidates(from, to)
  const selectedIds = new Set(patientIds)
  const items: BatchRunItem[] = candidates
    .filter((c) => selectedIds.has(c.patientId) && c.rideIds.length > 0)
    .map((c) => ({
      patientId: c.patientId,
      patientName: c.patientName,
      rideIds: c.rideIds,
      hasEmail: c.hasEmail,
    }))

  if (items.length === 0) {
    return {
      success: false,
      error: "Für die Auswahl gibt es keine quittierbaren Fahrten mehr.",
    }
  }

  const supabase = await createClient()

  const result = await runReceiptBatch(items, {
    // Issue through the user-scoped client so auth.uid() (issued_by) is set.
    issue: async (patientId, rideIds) => {
      const { data, error } = await supabase.rpc("issue_receipt", {
        p_patient_id: patientId,
        p_period_from: from,
        p_period_to: to,
        p_ride_ids: rideIds,
      })
      if (error || !data) {
        throw new Error(
          error?.message ?? "Die Quittung konnte nicht ausgestellt werden"
        )
      }
      return { id: data.id, receipt_number: data.receipt_number }
    },
    generatePdf: async (receiptId) => {
      await generateAndStoreReceiptPdf(receiptId)
    },
    sendEmail: sendEmail
      ? async (receiptId) => {
          const mail = await sendReceiptMail(receiptId)
          return mail.ok
            ? { ok: true }
            : { ok: false, error: mail.error }
        }
      : undefined,
  })

  revalidatePath("/finance/receipts")

  // Run-level audit entry (SEC-M14-006). The per-receipt 'create' entries are
  // written inside the RPC; this one records the batch as a whole.
  logAudit({
    userId: auth.userId,
    userRole: auth.role,
    action: "create",
    entityType: "report",
    metadata: {
      event: "receipt_batch_run",
      period_from: from,
      period_to: to,
      selected_patients: patientIds.length,
      issued_count: result.issuedCount,
      failed_count: result.failedCount,
      emailed: sendEmail,
      receipt_numbers: result.outcomes
        .filter((o) => o.receiptNumber)
        .map((o) => o.receiptNumber),
    },
  }).catch(() => {})

  return { success: true, data: result }
}
