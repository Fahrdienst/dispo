import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth/require-auth"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { ReceiptList, type ReceiptListRow } from "@/components/finance/receipt-list"

export const metadata: Metadata = {
  title: "Quittungen - Dispo",
}

// Finance go-live: receipts cannot predate the module. Used to build the year
// dropdown from go-live up to the current year.
const RECEIPTS_FIRST_YEAR = 2026

interface ReceiptsPageProps {
  searchParams: Promise<{ year?: string; created?: string }>
}

/** Shape of the joined query row (receipts + patients.email). */
interface ReceiptQueryRow {
  id: string
  receipt_number: string
  recipient_name: string
  patient_id: string | null
  period_from: string
  period_to: string
  total_amount: number
  currency: string
  status: "issued" | "cancelled"
  issued_at: string
  pdf_path: string | null
  patients: { email: string | null } | { email: string | null }[] | null
}

/** Normalise the to-one patient join (Supabase may type it as an array). */
function patientEmail(patients: ReceiptQueryRow["patients"]): string | null {
  if (!patients) return null
  const rel = Array.isArray(patients) ? patients[0] : patients
  return rel?.email ?? null
}

function buildYears(selectedYear: number): number[] {
  const currentYear = new Date().getFullYear()
  const maxYear = Math.max(currentYear, selectedYear)
  const years: number[] = []
  for (let y = maxYear; y >= RECEIPTS_FIRST_YEAR; y--) {
    years.push(y)
  }
  // Guard against a future/edge selected year not covered by the range.
  if (!years.includes(selectedYear)) years.unshift(selectedYear)
  return years
}

export default async function FinanceReceiptsPage({
  searchParams,
}: ReceiptsPageProps) {
  // Defense-in-depth: the /finance layout already gates admin+operator.
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    redirect("/login")
  }

  const params = await searchParams
  const parsedYear = params.year ? Number.parseInt(params.year, 10) : NaN
  const selectedYear =
    Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 9999
      ? parsedYear
      : new Date().getFullYear()
  const highlightId = params.created ?? null

  // RLS-scoped session client: only admin/operator can read receipts.
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("receipts")
    .select(
      "id, receipt_number, recipient_name, patient_id, period_from, period_to, total_amount, currency, status, issued_at, pdf_path, patients(email)"
    )
    .gte("issued_at", `${selectedYear}-01-01`)
    .lt("issued_at", `${selectedYear + 1}-01-01`)
    .order("issued_at", { ascending: false })

  if (error) {
    console.error("[finance/receipts] load failed:", error.message)
  }

  const rows: ReceiptListRow[] = ((data as ReceiptQueryRow[] | null) ?? []).map(
    (r) => ({
      id: r.id,
      receiptNumber: r.receipt_number,
      recipientName: r.recipient_name,
      patientId: r.patient_id,
      periodFrom: r.period_from,
      periodTo: r.period_to,
      totalAmount: r.total_amount,
      currency: r.currency,
      status: r.status,
      issuedAt: r.issued_at,
      hasPdf: r.pdf_path !== null,
      recipientEmail: patientEmail(r.patients),
    })
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">Quittungen</h3>
          <p className="text-sm text-muted-foreground">
            Zahlungsbestätigungen erstellen, versenden und stornieren.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/finance/receipts/batch">Sammellauf</Link>
          </Button>
          <Button asChild>
            <Link href="/finance/receipts/new">Neue Quittung</Link>
          </Button>
        </div>
      </div>
      <ReceiptList
        receipts={rows}
        years={buildYears(selectedYear)}
        selectedYear={selectedYear}
        highlightId={highlightId}
      />
    </div>
  )
}
