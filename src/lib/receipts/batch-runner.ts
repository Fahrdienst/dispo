/**
 * Per-patient work item for a batch run: the patient plus the exact set of
 * priced ride ids to receipt (re-derived server-side, never trusted from the
 * client).
 */
export interface BatchRunItem {
  patientId: string
  patientName: string
  rideIds: string[]
  /** Whether a patient e-mail is on file (only relevant when `sendEmail`). */
  hasEmail: boolean
}

/** Outcome for a single patient in a batch run. */
export interface BatchRunOutcome {
  patientId: string
  patientName: string
  status: "issued" | "failed"
  receiptId: string | null
  receiptNumber: string | null
  rideCount: number
  /** True when the per-receipt PDF was stored; false means a later retry. */
  pdfGenerated: boolean
  /** Mail result for this patient (only set when the run requested e-mail). */
  email: "sent" | "no_email" | "failed" | "skipped"
  /** German error message when `status === "failed"` or mail failed. */
  error: string | null
}

/** Aggregate result of a batch run. */
export interface BatchRunResult {
  outcomes: BatchRunOutcome[]
  issuedCount: number
  failedCount: number
  /** Receipt ids of successfully issued receipts (feed the collective PDF). */
  receiptIds: string[]
}

/**
 * Injected side effects, so the orchestration can be unit-tested without a DB,
 * Storage or a mail transport. Each maps to a real dependency in the action.
 */
export interface BatchRunDeps {
  /** Issue one receipt atomically (the `issue_receipt` RPC). */
  issue: (
    patientId: string,
    rideIds: string[]
  ) => Promise<{ id: string; receipt_number: string }>
  /** Generate + store the per-receipt PDF (archival source of truth). */
  generatePdf: (receiptId: string) => Promise<void>
  /** Send the receipt to the patient (only called when requested + hasEmail). */
  sendEmail?: (receiptId: string) => Promise<{ ok: boolean; error?: string }>
}

/**
 * Run a receipt batch (concept 4.2): for each patient, issue ONE receipt in its
 * OWN transaction, then generate its PDF. A failure for one patient is isolated
 * — the loop continues and the failure is reported per patient (partial-result
 * report). Issuing and PDF generation are decoupled (ADR-015 E5): a PDF failure
 * still yields a valid receipt (retryable later), it does not fail the patient.
 *
 * When `sendEmail` is provided, each successfully-issued receipt is additionally
 * mailed to patients with an address on file; patients without one are reported
 * as `no_email` ("nur Druck"). Mail failures never fail the receipt.
 */
export async function runReceiptBatch(
  items: readonly BatchRunItem[],
  deps: BatchRunDeps
): Promise<BatchRunResult> {
  const outcomes: BatchRunOutcome[] = []
  const receiptIds: string[] = []

  for (const item of items) {
    if (item.rideIds.length === 0) {
      // Nothing billable for this patient — skip without issuing.
      outcomes.push({
        patientId: item.patientId,
        patientName: item.patientName,
        status: "failed",
        receiptId: null,
        receiptNumber: null,
        rideCount: 0,
        pdfGenerated: false,
        email: "skipped",
        error: "Keine quittierbaren Fahrten",
      })
      continue
    }

    let receipt: { id: string; receipt_number: string }
    try {
      receipt = await deps.issue(item.patientId, item.rideIds)
    } catch (err) {
      outcomes.push({
        patientId: item.patientId,
        patientName: item.patientName,
        status: "failed",
        receiptId: null,
        receiptNumber: null,
        rideCount: item.rideIds.length,
        pdfGenerated: false,
        email: "skipped",
        error:
          err instanceof Error
            ? err.message
            : "Die Quittung konnte nicht ausgestellt werden",
      })
      continue
    }

    receiptIds.push(receipt.id)

    // PDF generation is decoupled: a failure here is non-blocking.
    let pdfGenerated = true
    try {
      await deps.generatePdf(receipt.id)
    } catch {
      pdfGenerated = false
    }

    // Optional mail step.
    let email: BatchRunOutcome["email"] = "skipped"
    let mailError: string | null = null
    if (deps.sendEmail) {
      if (!item.hasEmail) {
        email = "no_email"
      } else if (!pdfGenerated) {
        // Cannot attach a PDF that was not produced.
        email = "failed"
        mailError = "Kein PDF für den Versand vorhanden"
      } else {
        try {
          const result = await deps.sendEmail(receipt.id)
          email = result.ok ? "sent" : "failed"
          mailError = result.ok ? null : (result.error ?? "Versand fehlgeschlagen")
        } catch (err) {
          email = "failed"
          mailError = err instanceof Error ? err.message : "Versand fehlgeschlagen"
        }
      }
    }

    outcomes.push({
      patientId: item.patientId,
      patientName: item.patientName,
      status: "issued",
      receiptId: receipt.id,
      receiptNumber: receipt.receipt_number,
      rideCount: item.rideIds.length,
      pdfGenerated,
      email,
      error: mailError,
    })
  }

  const issuedCount = outcomes.filter((o) => o.status === "issued").length
  return {
    outcomes,
    issuedCount,
    failedCount: outcomes.length - issuedCount,
    receiptIds,
  }
}
