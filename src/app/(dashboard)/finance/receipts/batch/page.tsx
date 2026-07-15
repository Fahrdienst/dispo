import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth/require-auth"
import { ReceiptBatchForm } from "@/components/finance/receipt-batch-form"

export const metadata: Metadata = {
  title: "Sammellauf - Dispo",
}

/**
 * Batch receipt run (Issue #152, concept 4.2). Choose a period, review all
 * patients with billable rides, then issue one receipt per patient plus an
 * on-demand collective PDF for printing.
 */
export default async function ReceiptBatchPage(): Promise<React.ReactElement> {
  // Defense-in-depth: the /finance layout already gates admin+operator.
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    redirect("/login")
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <Link
          href="/finance/receipts"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Zurück zu den Quittungen
        </Link>
        <h3 className="text-xl font-semibold tracking-tight">Sammellauf</h3>
        <p className="text-sm text-muted-foreground">
          Für einen Zeitraum je Patient eine Quittung ausstellen und ein
          Sammel-PDF zum Ausdrucken erzeugen.
        </p>
      </div>

      <ReceiptBatchForm />
    </div>
  )
}
