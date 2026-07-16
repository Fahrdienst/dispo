import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth/require-auth"
import { getStatistics } from "@/lib/finance/statistics-data"
import { StatisticsTable } from "@/components/finance/statistics-table"
import { StatisticsExportButton } from "@/components/finance/statistics-export-button"
import {
  isStatDimension,
  SENSITIVE_DIMENSIONS,
  STAT_DIMENSIONS,
  STAT_DIMENSION_LABELS,
  type StatDimension,
} from "@/lib/finance/statistics"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Statistik - Dispo",
}

const DEFAULT_DIMENSION: StatDimension = "month"

/** Validate a date string is YYYY-MM-DD format. */
function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))
}

function yearStart(year: number): string {
  return `${year}-01-01`
}

function yearEnd(year: number): string {
  return `${year}-12-31`
}

/** Format date range for display: "01.01.2026 – 31.12.2026". */
function formatDateRange(from: string, to: string): string {
  const fmt = (d: string): string =>
    new Date(d + "T00:00:00").toLocaleDateString("de-CH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  return `${fmt(from)} – ${fmt(to)}`
}

/** Build a /finance/statistics URL preserving the given params. */
function buildUrl(params: {
  dimension: StatDimension
  dateFrom: string
  dateTo: string
}): string {
  const sp = new URLSearchParams({
    dimension: params.dimension,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
  })
  return `/finance/statistics?${sp.toString()}`
}

interface StatisticsPageProps {
  searchParams: Promise<{
    dimension?: string
    dateFrom?: string
    dateTo?: string
  }>
}

export default async function FinanceStatisticsPage({
  searchParams,
}: StatisticsPageProps): Promise<React.ReactElement> {
  // Defense-in-depth: the /finance layout already gates admin+operator.
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    redirect("/login")
  }

  const params = await searchParams

  const dimension: StatDimension =
    params.dimension && isStatDimension(params.dimension)
      ? params.dimension
      : DEFAULT_DIMENSION

  // Default period = current year (answers "wie viele km gesamt dieses Jahr?").
  const currentYear = new Date().getFullYear()
  const dateFrom =
    params.dateFrom && isValidDate(params.dateFrom)
      ? params.dateFrom
      : yearStart(currentYear)
  const dateTo =
    params.dateTo && isValidDate(params.dateTo)
      ? params.dateTo
      : yearEnd(currentYear)

  const result = await getStatistics({ dateFrom, dateTo, dimension })
  const { rows, summary } = result

  // Quick year buttons: current year plus the previous three.
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3]

  const isSensitive = SENSITIVE_DIMENSIONS.has(dimension)

  return (
    <div className="space-y-6">
      {/* Dimension selector */}
      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">
          Dimension
        </p>
        <nav className="flex flex-wrap gap-1 rounded-lg border bg-muted p-1">
          {STAT_DIMENSIONS.map((dim) => {
            const isActive = dim === dimension
            return (
              <Link
                key={dim}
                href={buildUrl({ dimension: dim, dateFrom, dateTo })}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {STAT_DIMENSION_LABELS[dim]}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Period: quick year buttons + free range */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Jahr</p>
          <div className="flex flex-wrap gap-1">
            {yearOptions.map((year) => {
              const active =
                dateFrom === yearStart(year) && dateTo === yearEnd(year)
              return (
                <Button
                  key={year}
                  variant={active ? "secondary" : "outline"}
                  size="sm"
                  asChild
                >
                  <Link
                    href={buildUrl({
                      dimension,
                      dateFrom: yearStart(year),
                      dateTo: yearEnd(year),
                    })}
                  >
                    {year}
                  </Link>
                </Button>
              )
            })}
          </div>
        </div>

        <form
          method="get"
          action="/finance/statistics"
          className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3"
        >
          <input type="hidden" name="dimension" value={dimension} />
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

        <div className="ml-auto flex flex-col items-end gap-1">
          <span className="text-sm font-medium">
            {formatDateRange(dateFrom, dateTo)}
          </span>
          <StatisticsExportButton
            dimension={dimension}
            dateFrom={dateFrom}
            dateTo={dateTo}
            disabled={rows.length === 0}
          />
        </div>
      </div>

      {/* Confidentiality hint for health-inferable dimensions (SEC-M14-009) */}
      {isSensitive && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-medium">Vertraulich</p>
          <p className="mt-0.5">
            {dimension === "destination"
              ? "Zielnamen können einen medizinischen Kontext offenlegen (z.B. Spitäler/Kliniken). Dieser Export gilt als VERTRAULICH und darf die Organisation nicht verlassen."
              : "Der Export pseudonymisiert Patienten (keine Klarnamen). Die Auswertung gilt als VERTRAULICH und darf die Organisation nicht verlassen."}
          </p>
        </div>
      )}

      {/* Aggregation table */}
      <StatisticsTable dimension={dimension} rows={rows} summary={summary} />

      {/* Footnotes */}
      <div className="space-y-1 text-xs text-muted-foreground">
        <p>
          Nur <strong>abgeschlossene</strong> Fahrten. <strong>km</strong> = Σ
          erfasste Distanz; <strong>davon nachber.</strong> = km, die
          nachträglich per Backfill/Schätzung ermittelt wurden (
          {summary.backfillKm > 0
            ? `davon ${summary.backfillKm.toLocaleString("de-CH", {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })} km nachberechnet`
            : "keine nachberechneten km"}
          ). <strong>ohne km</strong> = Fahrten ohne erfasste Distanz (
          {summary.ridesWithoutKm}). <strong>Fahrzeit</strong> = reine Fahrzeit
          Patient → Ziel. <strong>Umsatz</strong> = Σ Fahrpreis
          (COALESCE(price_override, calculated_price)).
        </p>
        <p>
          Spalten sind sortierbar (Klick auf die Überschrift). Der CSV-Export
          enthält nur die angezeigten Aggregat-Zeilen.
        </p>
      </div>
    </div>
  )
}
