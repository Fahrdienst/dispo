import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth/require-auth"
import { getPatientsList } from "@/actions/combobox"
import { ReceiptCreateForm } from "@/components/finance/receipt-create-form"

export const metadata: Metadata = {
  title: "Neue Quittung - Dispo",
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Receipt create flow (Issue #147, concept 4.1). Accepts optional pre-fill
 * search params `patientId`, `from`, `to` (YYYY-MM-DD) — the contract the
 * patient detail (Peter C) links against.
 */
export default async function NewReceiptPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string; from?: string; to?: string }>
}): Promise<React.ReactElement> {
  // Defense-in-depth: the /finance layout already gates admin+operator.
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    redirect("/login")
  }

  const params = await searchParams
  const defaultPatientId =
    params.patientId && UUID_RE.test(params.patientId) ? params.patientId : null
  const defaultFrom =
    params.from && DATE_RE.test(params.from) ? params.from : null
  const defaultTo = params.to && DATE_RE.test(params.to) ? params.to : null

  const patients = await getPatientsList()

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <Link
          href="/finance/receipts"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Zurück zu den Quittungen
        </Link>
        <h3 className="text-xl font-semibold tracking-tight">Neue Quittung</h3>
        <p className="text-sm text-muted-foreground">
          Patient und Zeitraum wählen, Fahrten prüfen und die Zahlungsbestätigung
          ausstellen.
        </p>
      </div>

      <ReceiptCreateForm
        patients={patients}
        defaultPatientId={defaultPatientId}
        defaultFrom={defaultFrom}
        defaultTo={defaultTo}
      />
    </div>
  )
}
