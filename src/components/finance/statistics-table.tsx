"use client"

import { useMemo, useState } from "react"
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import {
  STAT_DIMENSION_LABELS,
  type StatDimension,
  type StatRow,
  type StatSummary,
} from "@/lib/finance/statistics"

interface StatisticsTableProps {
  dimension: StatDimension
  rows: StatRow[]
  summary: StatSummary
}

/** Sortable columns. `label` sorts the dimension text, the rest sort numerically. */
type SortKey =
  | "label"
  | "rideCount"
  | "totalKm"
  | "backfillKm"
  | "ridesWithoutKm"
  | "totalDurationSeconds"
  | "revenue"

type SortDir = "asc" | "desc"

/** Format a CHF amount with two decimals (e.g. "1'234.50"). */
function chf(value: number): string {
  return value.toLocaleString("de-CH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Format km with one decimal. */
function km(value: number): string {
  return value.toLocaleString("de-CH", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

/** Format total seconds as "h:mm" (e.g. 5400 → "1:30"). */
function formatDuration(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60)
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}:${m.toString().padStart(2, "0")}`
}

export function StatisticsTable({
  dimension,
  rows,
  summary,
}: StatisticsTableProps): React.ReactElement {
  // Default: keep the server order (chronological / by count). null = unsorted.
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null)

  function toggleSort(key: SortKey): void {
    setSort((prev) => {
      if (!prev || prev.key !== key) {
        // Text columns start ascending, numeric columns start descending.
        return { key, dir: key === "label" ? "asc" : "desc" }
      }
      return { key, dir: prev.dir === "asc" ? "desc" : "asc" }
    })
  }

  const sortedRows = useMemo(() => {
    if (!sort) return rows
    const factor = sort.dir === "asc" ? 1 : -1
    const copy = [...rows]
    copy.sort((a, b) => {
      if (sort.key === "label") {
        return a.label.localeCompare(b.label, "de-CH") * factor
      }
      return (a[sort.key] - b[sort.key]) * factor
    })
    return copy
  }, [rows, sort])

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Keine abgeschlossenen Fahrten in diesem Zeitraum.
      </div>
    )
  }

  const dimensionLabel = STAT_DIMENSION_LABELS[dimension]

  function SortIcon({ column }: { column: SortKey }): React.ReactElement {
    if (!sort || sort.key !== column) {
      return <ChevronsUpDown className="ml-1 inline h-3 w-3 opacity-40" />
    }
    return sort.dir === "asc" ? (
      <ArrowUp className="ml-1 inline h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 inline h-3 w-3" />
    )
  }

  function HeaderButton({
    column,
    children,
    align = "right",
  }: {
    column: SortKey
    children: React.ReactNode
    align?: "left" | "right"
  }): React.ReactElement {
    return (
      <button
        type="button"
        onClick={() => toggleSort(column)}
        aria-label={`Sortieren nach ${typeof children === "string" ? children : column}`}
        className={cn(
          "inline-flex w-full items-center font-medium hover:text-foreground",
          align === "right" ? "justify-end" : "justify-start"
        )}
      >
        {children}
        <SortIcon column={column} />
      </button>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <HeaderButton column="label" align="left">
                {dimensionLabel}
              </HeaderButton>
            </TableHead>
            <TableHead className="text-right">
              <HeaderButton column="rideCount">Fahrten</HeaderButton>
            </TableHead>
            <TableHead className="text-right">
              <HeaderButton column="totalKm">km</HeaderButton>
            </TableHead>
            <TableHead className="text-right">
              <HeaderButton column="backfillKm">davon nachber.</HeaderButton>
            </TableHead>
            <TableHead className="text-right">
              <HeaderButton column="ridesWithoutKm">ohne km</HeaderButton>
            </TableHead>
            <TableHead className="text-right">
              <HeaderButton column="totalDurationSeconds">Fahrzeit</HeaderButton>
            </TableHead>
            <TableHead className="text-right">
              <HeaderButton column="revenue">Umsatz (CHF)</HeaderButton>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.map((row) => (
            <TableRow key={row.key}>
              <TableCell className="font-medium">{row.label}</TableCell>
              <TableCell className="text-right tabular-nums">
                {row.rideCount}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {km(row.totalKm)}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right tabular-nums",
                  row.backfillKm > 0
                    ? "text-amber-600"
                    : "text-muted-foreground"
                )}
                title={
                  row.backfillKm > 0
                    ? "km aus Backfill/Schätzung (nachträglich berechnet)"
                    : undefined
                }
              >
                {row.backfillKm > 0 ? km(row.backfillKm) : "–"}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right tabular-nums",
                  row.ridesWithoutKm > 0
                    ? "text-amber-600"
                    : "text-muted-foreground"
                )}
                title={
                  row.ridesWithoutKm > 0
                    ? "Fahrten ohne erfasste Distanz"
                    : undefined
                }
              >
                {row.ridesWithoutKm > 0 ? row.ridesWithoutKm : "–"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatDuration(row.totalDurationSeconds)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {chf(row.revenue)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className="font-semibold">
              Total ({summary.rowCount})
            </TableCell>
            <TableCell className="text-right font-semibold tabular-nums">
              {summary.totalRides}
            </TableCell>
            <TableCell className="text-right font-semibold tabular-nums">
              {km(summary.totalKm)}
            </TableCell>
            <TableCell
              className={cn(
                "text-right font-semibold tabular-nums",
                summary.backfillKm > 0 && "text-amber-600"
              )}
            >
              {summary.backfillKm > 0 ? km(summary.backfillKm) : "–"}
            </TableCell>
            <TableCell
              className={cn(
                "text-right font-semibold tabular-nums",
                summary.ridesWithoutKm > 0 && "text-amber-600"
              )}
            >
              {summary.ridesWithoutKm > 0 ? summary.ridesWithoutKm : "–"}
            </TableCell>
            <TableCell className="text-right font-semibold tabular-nums">
              {formatDuration(summary.totalDurationSeconds)}
            </TableCell>
            <TableCell className="text-right font-semibold tabular-nums">
              {chf(summary.totalRevenue)}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  )
}
