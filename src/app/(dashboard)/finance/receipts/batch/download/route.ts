import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { requireAuth } from "@/lib/auth/require-auth"
import { logAudit } from "@/lib/audit/logger"
import { renderBatchReceiptPdf } from "@/lib/receipts/batch-pdf-service"

// @react-pdf/renderer needs the Node runtime (ADR-015 E6).
export const runtime = "nodejs"
// Never cache: the PDF is generated on demand from private receipt data.
export const dynamic = "force-dynamic"

// Guard against oversized requests; a monthly run stays well below this.
const MAX_RECEIPTS = 500

const bodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(MAX_RECEIPTS),
})

/**
 * On-demand collective batch PDF download (concept 4.2, ADR-015 E6).
 *
 * POST with `{ ids: string[] }` (the receipt ids of a run). Auth-gated to
 * admin+operator. The PDF is re-rendered from the immutable snapshots and
 * streamed back as an attachment — it is NOT persisted to Storage (the
 * per-receipt PDFs are the archival source of truth). Ids are sent in the body
 * (not the URL) to avoid length limits and keep them out of access logs.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 })
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ungültige Beleg-Auswahl" },
      { status: 400 }
    )
  }

  try {
    const { buffer } = await renderBatchReceiptPdf(parsed.data.ids)
    const filename = `Sammellauf-${new Date().toISOString().slice(0, 10)}.pdf`

    // SEC-M14-006: the collective PDF is the richest export surface (names +
    // health-inferable destinations), so the download must be attributable.
    logAudit({
      userId: auth.userId,
      userRole: auth.role,
      action: "export",
      entityType: "report",
      metadata: {
        report_type: "receipt_batch_pdf",
        receipt_count: parsed.data.ids.length,
      },
    }).catch(() => {})

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (err) {
    console.error(
      "[batch-download] render failed:",
      err instanceof Error ? err.message : err
    )
    return NextResponse.json(
      { error: "Das Sammel-PDF konnte nicht erzeugt werden." },
      { status: 500 }
    )
  }
}
