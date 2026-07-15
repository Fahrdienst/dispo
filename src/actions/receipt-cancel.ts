"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAuth } from "@/lib/auth/require-auth"
import { logAudit } from "@/lib/audit/logger"
import type { ActionResult } from "@/actions/shared"

/**
 * Storno input. The reason is MANDATORY (Konzept 4.3, DB CHECK
 * `cancelled_needs_reason`). We enforce it here too so the user gets a friendly
 * German message instead of a raw constraint violation.
 */
export const cancelReceiptSchema = z.object({
  receiptId: z.string().uuid("Ungültige Beleg-ID"),
  reason: z
    .string()
    .trim()
    .min(3, "Bitte geben Sie eine Storno-Begründung an (mind. 3 Zeichen).")
    .max(1000, "Die Begründung ist zu lang (max. 1000 Zeichen)."),
})

export type CancelReceiptInput = z.infer<typeof cancelReceiptSchema>

/**
 * Cancel (storno) an issued receipt (Issue #149).
 *
 * - Access: admin + operator.
 * - Sets `status='cancelled'`, `cancelled_reason`, `cancelled_at`. The DB
 *   triggers do the rest: item propagation (`receipt_items.is_cancelled=true`)
 *   makes the rides billable again, and the immutability trigger blocks every
 *   other column change.
 * - The PDF stays archived and downloadable — a storno is a marking, not a
 *   deletion (Konzept 4.3).
 * - Audit trail: `action='cancel'`, `entity_type='receipt'` (SEC-M14-006).
 *
 * The UPDATE runs through the service-role client: `receipts` has no permissive
 * UPDATE policy (Default-Deny, SEC-M14-001), so the write path is server-only.
 * The immutability trigger still fires and constrains the columns.
 */
export async function cancelReceipt(
  input: CancelReceiptInput
): Promise<ActionResult<{ receiptNumber: string }>> {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const parsed = cancelReceiptSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Ungültige Eingabe."
    return { success: false, error: firstError }
  }
  const { receiptId, reason } = parsed.data

  // Load the current receipt via the RLS-scoped session client.
  const supabase = await createClient()
  const { data: receipt, error: loadError } = await supabase
    .from("receipts")
    .select("id, status, receipt_number")
    .eq("id", receiptId)
    .single()

  if (loadError || !receipt) {
    return { success: false, error: "Beleg nicht gefunden." }
  }

  if (receipt.status === "cancelled") {
    return { success: false, error: "Dieser Beleg ist bereits storniert." }
  }

  // Perform the storno. Service-role client: no UPDATE policy exists for
  // authenticated (Default-Deny). The immutability trigger enforces that only
  // {status, cancelled_reason, cancelled_at} may change.
  const admin = createAdminClient()
  const { error: updateError } = await admin
    .from("receipts")
    .update({
      status: "cancelled",
      cancelled_reason: reason,
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", receiptId)
    .eq("status", "issued") // guard against a concurrent double-storno

  if (updateError) {
    console.error("[receipt-cancel] update failed:", updateError.message)
    return {
      success: false,
      error: "Der Beleg konnte nicht storniert werden. Bitte versuchen Sie es erneut.",
    }
  }

  // SEC-M14-006: cancellation must be attributable.
  logAudit({
    userId: auth.userId,
    userRole: auth.role,
    action: "cancel",
    entityType: "receipt",
    entityId: receiptId,
    metadata: {
      receipt_number: receipt.receipt_number,
      cancelled_reason: reason,
    },
  }).catch(() => {})

  revalidatePath("/finance/receipts")

  return { success: true, data: { receiptNumber: receipt.receipt_number } }
}
