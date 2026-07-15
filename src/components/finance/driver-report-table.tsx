"use client"

import { Fragment, useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDateDE } from "@/lib/utils/dates"
import { cn } from "@/lib/utils"
import type {
  DriverRideDetail,
  DriverReportRow,
  DriverReportSummary,
} from "@/lib/finance/driver-report"

interface DriverReportTableProps {
  rows: DriverReportRow[]
  details: Record<string, DriverRideDetail[]>
  summary: DriverReportSummary
}

/** Format a CHF amount with two decimals (e.g. "1'234.50"). */
function chf(value: number): string {
  return value.toLocaleString("de-CH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Format total seconds as "h:mm" (e.g. 5400 → "1:30"). */
function formatDuration(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60)
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}:${m.toString().padStart(2, "0")}`
}

/** Format km with one decimal. */
function km(value: number): string {
  return value.toLocaleString("de-CH", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

export function DriverReportTable({
  rows,
  details,
  summary,
}: DriverReportTableProps): React.ReactElement {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggle(driverId: string): void {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(driverId)) {
        next.delete(driverId)
      } else {
        next.add(driverId)
      }
      return next
    })
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Keine abgeschlossenen Fahrten mit zugewiesenem Fahrer in diesem Zeitraum.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[36px]" />
            <TableHead>Fahrer</TableHead>
            <TableHead className="text-right">Fahrten</TableHead>
            <TableHead className="text-right">km</TableHead>
            <TableHead className="text-right">Einsatzzeit</TableHead>
            <TableHead className="text-right">Einnahmen (CHF)</TableHead>
            <TableHead className="text-right">Entschädigung (CHF)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const isOpen = expanded.has(row.driverId)
            const rideDetails = details[row.driverId] ?? []
            const hasQualityFlag =
              row.ridesWithoutKm > 0 || row.ridesWithoutPrice > 0

            return (
              <Fragment key={row.driverId}>
                <TableRow
                  className="cursor-pointer"
                  onClick={() => toggle(row.driverId)}
                >
                  <TableCell className="align-middle">
                    <button
                      type="button"
                      aria-label={
                        isOpen ? "Fahrten ausblenden" : "Fahrten anzeigen"
                      }
                      aria-expanded={isOpen}
                      onClick={(e) => {
                        e.stopPropagation()
                        toggle(row.driverId)
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted"
                    >
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                  </TableCell>
                  <TableCell className="font-medium">
                    {row.driverName}
                    {hasQualityFlag && (
                      <span
                        className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-normal text-amber-700"
                        title="Fahrten ohne km oder ohne Preis"
                      >
                        {row.ridesWithoutKm > 0 &&
                          `${row.ridesWithoutKm}× ohne km`}
                        {row.ridesWithoutKm > 0 &&
                          row.ridesWithoutPrice > 0 &&
                          ", "}
                        {row.ridesWithoutPrice > 0 &&
                          `${row.ridesWithoutPrice}× ohne Preis`}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.rideCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {km(row.totalKm)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatDuration(row.totalDurationSeconds)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {chf(row.revenue)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {chf(row.compensation)}
                  </TableCell>
                </TableRow>

                {isOpen && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={7} className="bg-muted/40 p-0">
                      <div className="px-4 py-3">
                        <p className="mb-2 text-xs font-medium text-muted-foreground">
                          Einzelfahrten ({rideDetails.length})
                        </p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-xs text-muted-foreground">
                                <th className="py-1 pr-4 font-medium">Datum</th>
                                <th className="py-1 pr-4 font-medium">Ziel</th>
                                <th className="py-1 pr-4 text-right font-medium">
                                  km
                                </th>
                                <th className="py-1 text-right font-medium">
                                  Preis (CHF)
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {rideDetails.map((detail) => (
                                <tr
                                  key={detail.rideId}
                                  className="border-t border-border/60"
                                >
                                  <td className="py-1.5 pr-4 whitespace-nowrap">
                                    {formatDateDE(detail.date)}
                                  </td>
                                  <td className="py-1.5 pr-4">
                                    {detail.destinationName ?? "–"}
                                  </td>
                                  <td
                                    className={cn(
                                      "py-1.5 pr-4 text-right tabular-nums",
                                      detail.distanceKm == null &&
                                        "text-amber-600"
                                    )}
                                  >
                                    {detail.distanceKm != null
                                      ? km(detail.distanceKm)
                                      : "fehlt"}
                                  </td>
                                  <td
                                    className={cn(
                                      "py-1.5 text-right tabular-nums",
                                      detail.price == null && "text-amber-600"
                                    )}
                                  >
                                    {detail.price != null
                                      ? chf(detail.price)
                                      : "fehlt"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            )
          })}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell />
            <TableCell className="font-semibold">
              Total ({summary.driverCount} Fahrer)
            </TableCell>
            <TableCell className="text-right font-semibold tabular-nums">
              {summary.totalRides}
            </TableCell>
            <TableCell className="text-right font-semibold tabular-nums">
              {km(summary.totalKm)}
            </TableCell>
            <TableCell className="text-right font-semibold tabular-nums">
              {formatDuration(summary.totalDurationSeconds)}
            </TableCell>
            <TableCell className="text-right font-semibold tabular-nums">
              {chf(summary.totalRevenue)}
            </TableCell>
            <TableCell className="text-right font-semibold tabular-nums">
              {chf(summary.totalCompensation)}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  )
}
