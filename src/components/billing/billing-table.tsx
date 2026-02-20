"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/shared/empty-state"
import { cn } from "@/lib/utils"
import type { BillingExportRow, BillingSummary } from "@/lib/billing/export"

// =============================================================================
// Types
// =============================================================================

interface BillingTableProps {
  rows: BillingExportRow[]
  summary: BillingSummary
}

type SortField = "date" | "effective_price"
type SortDirection = "asc" | "desc"

// =============================================================================
// Helpers
// =============================================================================

function getPriceColorClass(row: BillingExportRow): string {
  if (row.effective_price == null) return "text-red-600 font-medium"
  if (row.price_override != null) return "text-amber-600 font-medium"
  return "text-green-700"
}

function getPriceRowClass(row: BillingExportRow): string {
  if (row.effective_price == null) return "bg-red-50/50"
  if (row.price_override != null) return "bg-amber-50/50"
  return ""
}

function parsePrice(value: string | null): number {
  if (value == null) return -1
  const parsed = parseFloat(value)
  return isNaN(parsed) ? -1 : parsed
}

function formatChf(value: string | null): string {
  if (value == null) return "\u2013"
  return `CHF ${value}`
}

// =============================================================================
// Component
// =============================================================================

export function BillingTable({ rows, summary }: BillingTableProps) {
  const [search, setSearch] = useState("")
  const [sortField, setSortField] = useState<SortField>("date")
  const [sortDir, setSortDir] = useState<SortDirection>("asc")

  function handleSort(field: SortField): void {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDir("asc")
    }
  }

  function getSortIndicator(field: SortField): string {
    if (sortField !== field) return ""
    return sortDir === "asc" ? " \u2191" : " \u2193"
  }

  const filtered = useMemo(() => {
    let result = rows

    // Search filter
    if (search.trim()) {
      const term = search.toLowerCase()
      result = result.filter(
        (r) =>
          r.patient_name.toLowerCase().includes(term) ||
          r.destination_name.toLowerCase().includes(term) ||
          (r.driver_name?.toLowerCase().includes(term) ?? false) ||
          r.ride_id.toLowerCase().includes(term)
      )
    }

    // Sort
    const sorted = [...result].sort((a, b) => {
      let cmp = 0
      if (sortField === "date") {
        // Sort by date first, then pickup_time
        cmp = a.date.localeCompare(b.date)
        if (cmp === 0) {
          cmp = a.pickup_time.localeCompare(b.pickup_time)
        }
      } else if (sortField === "effective_price") {
        cmp = parsePrice(a.effective_price) - parsePrice(b.effective_price)
      }
      return sortDir === "desc" ? -cmp : cmp
    })

    return sorted
  }, [rows, search, sortField, sortDir])

  return (
    <div className="space-y-4">
      {/* Search */}
      <Input
        placeholder="Suchen (Patient, Ziel, Fahrer)..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {/* Plausibility warnings */}
      {(summary.missingPriceCount > 0 || summary.missingZoneCount > 0) && (
        <div className="space-y-2">
          {summary.missingPriceCount > 0 && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <span className="font-medium">Warnung:</span>{" "}
              {summary.missingPriceCount} Fahrt(en) ohne berechneten Preis
            </div>
          )}
          {summary.missingZoneCount > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <span className="font-medium">Warnung:</span>{" "}
              {summary.missingZoneCount} Fahrt(en) ohne Zonenzuordnung
            </div>
          )}
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState message="Keine Fahrten im gewaehlten Zeitraum." />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort("date")}
                >
                  Datum{getSortIndicator("date")}
                </TableHead>
                <TableHead>Zeit</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Ziel</TableHead>
                <TableHead>Richtung</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Fahrer</TableHead>
                <TableHead>Zone (von)</TableHead>
                <TableHead>Zone (nach)</TableHead>
                <TableHead>Distanz</TableHead>
                <TableHead
                  className="cursor-pointer select-none text-right"
                  onClick={() => handleSort("effective_price")}
                >
                  Preis{getSortIndicator("effective_price")}
                </TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow
                  key={row.ride_id}
                  className={getPriceRowClass(row)}
                >
                  <TableCell className="whitespace-nowrap">
                    {row.date}
                  </TableCell>
                  <TableCell>{row.pickup_time}</TableCell>
                  <TableCell className="font-medium">
                    {row.patient_name}
                  </TableCell>
                  <TableCell>{row.destination_name}</TableCell>
                  <TableCell>{row.direction}</TableCell>
                  <TableCell>{row.status}</TableCell>
                  <TableCell>{row.driver_name ?? "\u2013"}</TableCell>
                  <TableCell>{row.from_zone ?? "\u2013"}</TableCell>
                  <TableCell>{row.to_zone ?? "\u2013"}</TableCell>
                  <TableCell>
                    {row.distance_km ? `${row.distance_km} km` : "\u2013"}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "whitespace-nowrap text-right",
                      getPriceColorClass(row)
                    )}
                    title={
                      row.price_override != null
                        ? `Override: CHF ${row.price_override} (${row.price_override_reason ?? "kein Grund"})`
                        : row.calculated_price != null
                          ? `Berechnet: CHF ${row.calculated_price}`
                          : "Kein Preis"
                    }
                  >
                    {formatChf(row.effective_price)}
                    {row.price_override != null && (
                      <span className="ml-1 text-xs" title="Manueller Override">
                        *
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/rides/${row.ride_id}`}
                      className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                    >
                      Details
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Summary footer */}
      {filtered.length > 0 && (
        <div className="flex flex-wrap gap-6 rounded-md border bg-muted/50 px-4 py-3 text-sm">
          <div>
            <span className="text-muted-foreground">Fahrten:</span>{" "}
            <span className="font-medium">{summary.totalRides}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Gesamtumsatz:</span>{" "}
            <span className="font-medium">
              CHF {summary.totalRevenue.toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Davon Override:</span>{" "}
            <span className="font-medium text-amber-600">
              {summary.overrideCount}x (CHF{" "}
              {summary.overrideRevenue.toFixed(2)})
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Ohne Preis:</span>{" "}
            <span
              className={cn(
                "font-medium",
                summary.missingPriceCount > 0 && "text-red-600"
              )}
            >
              {summary.missingPriceCount}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
