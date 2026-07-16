import "server-only"
import { renderToBuffer } from "@react-pdf/renderer"
import { createAdminClient } from "@/lib/supabase/admin"
import { loadReceiptPdfData } from "@/lib/receipts/pdf-service"
import { BatchReceiptDocument } from "@/lib/receipts/batch-pdf-document"
import type { ReceiptPdfData } from "@/lib/receipts/types"

/**
 * Render a single, multi-page collective PDF for a batch run (concept 4.2,
 * ADR-015 E6). One page per receipt, re-rendered from the immutable snapshots.
 *
 * IMPORTANT: this PDF is produced ON-DEMAND for printing and is NOT persisted to
 * Storage — the per-receipt PDFs written by `generateAndStoreReceiptPdf` remain
 * the archival source of truth. Because the pages come from frozen snapshots the
 * output is deterministic and identical to those archived single PDFs.
 *
 * Receipts are rendered in ascending receipt-number order (stable, print-ready).
 * Individual receipts that cannot be loaded are skipped rather than failing the
 * whole document; if none can be loaded the function throws.
 *
 * @param receiptIds ids of the receipts issued by the run (order-independent).
 * @throws when `receiptIds` is empty or not a single receipt could be loaded.
 */
export async function renderBatchReceiptPdf(
  receiptIds: readonly string[]
): Promise<{ buffer: Buffer; count: number }> {
  if (receiptIds.length === 0) {
    throw new Error("Keine Belege für das Sammel-PDF angegeben")
  }

  const supabase = createAdminClient()

  const loaded: ReceiptPdfData[] = []
  for (const id of receiptIds) {
    try {
      loaded.push(await loadReceiptPdfData(supabase, id))
    } catch (err) {
      // Skip a single unreadable receipt; the collective print still succeeds
      // for the remaining ones.
      console.error(
        `[batch-pdf] skipping receipt ${id}:`,
        err instanceof Error ? err.message : err
      )
    }
  }

  if (loaded.length === 0) {
    throw new Error("Kein Beleg konnte für das Sammel-PDF geladen werden")
  }

  // Stable, print-friendly order by receipt number (e.g. Q-2026-00042).
  loaded.sort((a, b) => a.receiptNumber.localeCompare(b.receiptNumber))

  const title =
    loaded.length === 1
      ? `Quittung ${loaded[0]?.receiptNumber ?? ""}`.trim()
      : `Sammellauf ${loaded[0]?.periodFrom ?? ""} – ${loaded[loaded.length - 1]?.periodTo ?? ""}`

  const buffer = await renderToBuffer(
    BatchReceiptDocument({ receipts: loaded, title })
  )

  return { buffer, count: loaded.length }
}
