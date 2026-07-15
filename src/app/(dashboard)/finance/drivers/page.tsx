import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth/require-auth"
import { getDriverReport } from "@/lib/finance/driver-report-data"
import { DriverReportTable } from "@/components/finance/driver-report-table"
import { DriverReportExportButton } from "@/components/finance/driver-report-export-button"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export const metadata: Metadata = {
  title: "Fahrer-Reporting - Dispo",
}

/** First day of the current month as YYYY-MM-DD. */
function getMonthStart(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  return `${y}-${m}-01`
}

/** Last day of the current month as YYYY-MM-DD. */
function getMonthEnd(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const lastDay = new Date(y, m + 1, 0).getDate()
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
}

/** Validate a date string is YYYY-MM-DD format. */
function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))
}

/** Format date range for display: "01.02.2026 – 28.02.2026". */
function formatDateRange(from: string, to: string): string {
  const fmt = (d: string): string =>
    new Date(d + "T00:00:00").toLocaleDateString("de-CH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  return `${fmt(from)} – ${fmt(to)}`
}

/** Navigate to previous/next month from a given date. */
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

/** Format a compensation rate for display; "–" when unconfigured. */
function formatRate(value: number | null): string {
  return value != null
    ? `CHF ${value.toLocaleString("de-CH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : "–"
}

interface DriverReportPageProps {
  searchParams: Promise<{ dateFrom?: string; dateTo?: string }>
}

export default async function FinanceDriversPage({
  searchParams,
}: DriverReportPageProps): Promise<React.ReactElement> {
  // Defense-in-depth: the /finance layout already gates admin+operator.
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
    params.dateTo && isValidDate(params.dateTo) ? params.dateTo : getMonthEnd()

  const report = await getDriverReport({ dateFrom, dateTo })
  const { rows, details, summary, rates } = report

  const prev = shiftMonth(dateFrom, -1)
  const next = shiftMonth(dateFrom, 1)

  const hasQualityIssues =
    summary.ridesWithoutKm > 0 || summary.ridesWithoutPrice > 0

  return (
    <div className="space-y-6">
      {/* Period navigation */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/finance/drivers?dateFrom=${prev.from}&dateTo=${prev.to}`}>
            &larr; Vorheriger Monat
          </Link>
        </Button>
        <span className="px-1 text-sm font-medium">
          {formatDateRange(dateFrom, dateTo)}
        </span>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/finance/drivers?dateFrom=${next.from}&dateTo=${next.to}`}>
            Nächster Monat &rarr;
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/finance/drivers">Aktueller Monat</Link>
        </Button>

        <div className="ml-auto">
          <DriverReportExportButton
            dateFrom={dateFrom}
            dateTo={dateTo}
            disabled={rows.length === 0}
          />
        </div>
      </div>

      {/* Free date range */}
      <form
        method="get"
        action="/finance/drivers"
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3"
      >
        <div>
          <label
            htmlFor="dateFrom"
            className="mb-1 block text-xs font-medium text-muted-foreground"
          >
            Von
          </label>
          <Input
            type="date"
            id="dateFrom"
            name="dateFrom"
            defaultValue={dateFrom}
            className="w-auto"
          />
        </div>
        <div>
          <label
            htmlFor="dateTo"
            className="mb-1 block text-xs font-medium text-muted-foreground"
          >
            Bis
          </label>
          <Input
            type="date"
            id="dateTo"
            name="dateTo"
            defaultValue={dateTo}
            className="w-auto"
          />
        </div>
        <Button type="submit" variant="secondary" size="sm">
          Anwenden
        </Button>
      </form>

      {/* Data-quality banner */}
      {hasQualityIssues && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-medium">Datenqualität prüfen</p>
          <p className="mt-0.5">
            {summary.ridesWithoutKm > 0 && (
              <span>
                {summary.ridesWithoutKm}{" "}
                {summary.ridesWithoutKm === 1 ? "Fahrt" : "Fahrten"} ohne
                Distanz (km)
              </span>
            )}
            {summary.ridesWithoutKm > 0 && summary.ridesWithoutPrice > 0 && (
              <span>{" · "}</span>
            )}
            {summary.ridesWithoutPrice > 0 && (
              <span>
                {summary.ridesWithoutPrice}{" "}
                {summary.ridesWithoutPrice === 1 ? "Fahrt" : "Fahrten"} ohne
                Preis
              </span>
            )}
            {" — km und Entschädigung können dadurch zu tief ausgewiesen sein."}
          </p>
        </div>
      )}

      {/* Compensation rates in effect */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
        <span className="font-medium">Aktuelle Entschädigungssätze:</span>
        <span>
          Pauschale/Fahrt:{" "}
          <span className="font-medium">{formatRate(rates.perRideChf)}</span>
        </span>
        <span>
          km-Satz:{" "}
          <span className="font-medium">{formatRate(rates.perKmChf)}</span>
        </span>
        <Link
          href="/settings/organization"
          className="text-primary underline underline-offset-2 hover:no-underline"
        >
          Sätze anpassen
        </Link>
      </div>

      {/* Report table */}
      <DriverReportTable rows={rows} details={details} summary={summary} />

      {/* Footnote */}
      <p className="text-xs text-muted-foreground">
        <strong>Einsatzzeit</strong> = reine Fahrzeit Patient → Ziel (Σ
        Fahrtdauer); die Anfahrt des Fahrers ist nicht erfasst.{" "}
        <strong>Einnahmen</strong> entsprechen dem Barinkasso beim Fahrer und
        dienen dem Kassenabgleich. Die <strong>Entschädigung</strong> wird live
        aus den aktuellen Sätzen berechnet und nicht gespeichert — eine Änderung
        der Sätze wirkt sich rückwirkend auf alle Reports aus.
      </p>
    </div>
  )
}
