import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth/require-auth"
import { getBillingData } from "@/lib/billing/export"
import { PageHeader } from "@/components/dashboard/page-header"
import { BillingTable } from "@/components/billing/billing-table"
import { ExportButton } from "@/components/billing/export-button"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Verrechnung - Dispo",
}

/**
 * Get first day of current month as YYYY-MM-DD.
 */
function getMonthStart(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  return `${y}-${m}-01`
}

/**
 * Get last day of current month as YYYY-MM-DD.
 */
function getMonthEnd(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const lastDay = new Date(y, m + 1, 0).getDate()
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
}

/**
 * Validate a date string is YYYY-MM-DD format.
 */
function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value))
}

/**
 * Format date range for display: "01.02.2026 – 28.02.2026"
 */
function formatDateRange(from: string, to: string): string {
  const fromDate = new Date(from + "T00:00:00")
  const toDate = new Date(to + "T00:00:00")
  const fmt = (d: Date): string =>
    d.toLocaleDateString("de-CH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  return `${fmt(fromDate)} \u2013 ${fmt(toDate)}`
}

/**
 * Navigate to previous/next month from a given date.
 */
function shiftMonth(dateFrom: string, offset: number): { from: string; to: string } {
  const date = new Date(dateFrom + "T00:00:00")
  date.setMonth(date.getMonth() + offset)
  const y = date.getFullYear()
  const m = date.getMonth()
  const lastDay = new Date(y, m + 1, 0).getDate()
  return {
    from: `${y}-${String(m + 1).padStart(2, "0")}-01`,
    to: `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  }
}

interface BillingPageProps {
  searchParams: Promise<{ dateFrom?: string; dateTo?: string }>
}

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    redirect("/login")
  }

  const params = await searchParams
  const dateFrom =
    params.dateFrom && isValidDate(params.dateFrom)
      ? params.dateFrom
      : getMonthStart()
  const dateTo =
    params.dateTo && isValidDate(params.dateTo)
      ? params.dateTo
      : getMonthEnd()

  // Fetch billing data
  const { rows, summary } = await getBillingData({ dateFrom, dateTo })

  // Previous / Next month navigation
  const prev = shiftMonth(dateFrom, -1)
  const next = shiftMonth(dateFrom, 1)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Verrechnung"
        description="Abrechnungsuebersicht und CSV-Export"
      />

      {/* Date range navigation */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link
            href={`/billing?dateFrom=${prev.from}&dateTo=${prev.to}`}
          >
            &larr; Vorheriger Monat
          </Link>
        </Button>
        <span className="px-3 text-sm font-medium">
          {formatDateRange(dateFrom, dateTo)}
        </span>
        <Button variant="outline" size="sm" asChild>
          <Link
            href={`/billing?dateFrom=${next.from}&dateTo=${next.to}`}
          >
            Naechster Monat &rarr;
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/billing">Aktueller Monat</Link>
        </Button>

        <div className="ml-auto">
          <ExportButton dateFrom={dateFrom} dateTo={dateTo} />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard
          label="Fahrten"
          value={summary.totalRides.toString()}
        />
        <SummaryCard
          label="Gesamtumsatz"
          value={`CHF ${summary.totalRevenue.toFixed(2)}`}
        />
        <SummaryCard
          label="Overrides"
          value={`${summary.overrideCount}x`}
          sublabel={`CHF ${summary.overrideRevenue.toFixed(2)}`}
          variant={summary.overrideCount > 0 ? "warning" : "default"}
        />
        <SummaryCard
          label="Ohne Preis"
          value={summary.missingPriceCount.toString()}
          variant={summary.missingPriceCount > 0 ? "danger" : "default"}
        />
      </div>

      {/* Billing table */}
      <BillingTable rows={rows} summary={summary} />
    </div>
  )
}

// =============================================================================
// Summary Card
// =============================================================================

interface SummaryCardProps {
  label: string
  value: string
  sublabel?: string
  variant?: "default" | "warning" | "danger"
}

function SummaryCard({
  label,
  value,
  sublabel,
  variant = "default",
}: SummaryCardProps) {
  const borderColor =
    variant === "danger"
      ? "border-red-200"
      : variant === "warning"
        ? "border-amber-200"
        : "border-border"

  const valueColor =
    variant === "danger"
      ? "text-red-600"
      : variant === "warning"
        ? "text-amber-600"
        : "text-foreground"

  return (
    <div className={`rounded-lg border ${borderColor} bg-card p-4`}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold ${valueColor}`}>{value}</p>
      {sublabel && (
        <p className="text-xs text-muted-foreground">{sublabel}</p>
      )}
    </div>
  )
}
