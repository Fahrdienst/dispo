"use server"

import { requireAuth } from "@/lib/auth/require-auth"
import { logAudit } from "@/lib/audit/logger"
import { sendReceiptMail } from "@/lib/mail/receipt-mail"
import type { ActionResult } from "@/actions/shared"

/**
 * E-mail an issued receipt to the patient as a PDF attachment (Issue #151).
 *
 * - Access: admin + operator.
 * - The actual recipient resolution, PDF attachment and mail_log write happen
 *   server-side in `sendReceiptMail` — the client never supplies a recipient
 *   (SEC-M14-010: never trust a client-provided address).
 * - Data minimisation (SEC-M14-004): the body carries no ride/health details;
 *   the PDF is attached, never linked.
 * - Failure semantics: a mail failure is surfaced to the operator but is NOT a
 *   receipt problem (the receipt stays valid).
 * - Audit: the send is a disclosure of health-adjacent data — logged for
 *   accountability (in addition to the metadata-only `mail_log`).
 */
export async function emailReceipt(
  receiptId: string
): Promise<ActionResult<{ recipient: string }>> {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  if (!receiptId) {
    return { success: false, error: "Ungültige Anfrage." }
  }

  const result = await sendReceiptMail(receiptId)

  if (!result.ok) {
    return { success: false, error: result.error }
  }

  // Accountability: record who disclosed which receipt to which recipient.
  logAudit({
    userId: auth.userId,
    userRole: auth.role,
    action: "update",
    entityType: "receipt",
    entityId: receiptId,
    metadata: {
      event: "receipt_emailed",
      recipient: result.recipient,
    },
  }).catch(() => {})

  return { success: true, data: { recipient: result.recipient } }
}
