import { Document } from "@react-pdf/renderer"
import { ReceiptPage } from "@/lib/receipts/pdf-document"
import type { ReceiptPdfData } from "@/lib/receipts/types"

/**
 * Collective batch PDF (ADR-015 E6, concept 4.2/4.4): ONE multi-page document
 * with exactly one page per receipt, re-rendered from the immutable snapshots.
 *
 * This is deliberately NOT a binary PDF merge (no `pdf-lib`): because every page
 * is rendered from a frozen snapshot, the output is deterministic and visually
 * identical to the individually archived single-receipt PDFs. The collective PDF
 * is generated on-demand for printing and is NOT persisted — the per-receipt
 * PDFs in Storage remain the archival source of truth.
 *
 * Returns the root `<Document>` element directly so its type matches what
 * `renderToBuffer` accepts without a cast (same pattern as `ReceiptDocument`).
 */
export function BatchReceiptDocument({
  receipts,
  title,
}: {
  receipts: ReceiptPdfData[]
  title: string
}): React.ReactElement {
  const author = receipts[0]?.org.name ?? "Fahrdienst"

  return (
    <Document title={title} author={author} creator={author} producer="Dispo">
      {receipts.map((data, index) => (
        <ReceiptPage
          key={data.receiptNumber || index}
          pageKey={data.receiptNumber || index}
          data={data}
        />
      ))}
    </Document>
  )
}
