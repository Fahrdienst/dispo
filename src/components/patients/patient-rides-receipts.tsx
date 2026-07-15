"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Receipt } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { PatientRidesList } from "@/components/patients/patient-rides-list"
import { PatientReceiptsList } from "@/components/patients/patient-receipts-list"
import {
  buildActiveReceiptRideIds,
  buildReceiptRows,
  buildRideRows,
  countUnreceiptedCompleted,
  filterRowsByPeriod,
  formatChf,
  formatMonthLabel,
  getMonthBounds,
  isValidPeriod,
  type Period,
  type RawPatientReceipt,
  type RawPatientRide,
  type RawReceiptItem,
} from "@/lib/patients/rides-receipts"

interface PatientRidesReceiptsProps {
  patientId: string
  rides: RawPatientRide[]
  receiptItems: RawReceiptItem[]
  receipts: RawPatientReceipt[]
  /** Only admin/operator may create receipts. */
  canCreateReceipt: boolean
  /** Current month (server-computed to avoid hydration timezone drift). */
  currentYear: number
  currentMonth0: number
}

type FilterMode = "month" | "free"

/**
 * Client container for the patient "Fahrten & Quittungen" tab.
 *
 * Owns the period filter state (month quick-select + free from/to) and derives,
 * client-side, the filtered ride rows, the "Quittung erstellen" visibility and
 * its prefilled link. Receipts are shown in full (patient history), independent
 * of the ride period filter.
 */
export function PatientRidesReceipts({
  patientId,
  rides,
  receiptItems,
  receipts,
  canCreateReceipt,
  currentYear,
  currentMonth0,
}: PatientRidesReceiptsProps) {
  const [mode, setMode] = useState<FilterMode>("month")
  const [year, setYear] = useState(currentYear)
  const [month0, setMonth0] = useState(currentMonth0)

  const monthBounds = getMonthBounds(year, month0)
  const [freeFrom, setFreeFrom] = useState(monthBounds.from)
  const [freeTo, setFreeTo] = useState(monthBounds.to)

  // Build display rows once; filtering happens on the derived rows.
  const allRows = useMemo(() => {
    const activeReceiptRideIds = buildActiveReceiptRideIds(receiptItems)
    return buildRideRows(rides, activeReceiptRideIds)
  }, [rides, receiptItems])

  const receiptRows = useMemo(() => buildReceiptRows(receipts), [receipts])

  const freeValid = isValidPeriod(freeFrom, freeTo)

  const period: Period = useMemo(() => {
    if (mode === "month") return getMonthBounds(year, month0)
    return freeValid
      ? { from: freeFrom, to: freeTo }
      : getMonthBounds(year, month0)
  }, [mode, year, month0, freeValid, freeFrom, freeTo])

  const filteredRows = useMemo(
    () => filterRowsByPeriod(allRows, period),
    [allRows, period]
  )

  const unreceiptedCount = useMemo(
    () => countUnreceiptedCompleted(filteredRows),
    [filteredRows]
  )

  const periodTotal = useMemo(
    () =>
      filteredRows.reduce((sum, r) => sum + (r.price ?? 0), 0),
    [filteredRows]
  )

  const missingPriceCount = useMemo(
    () =>
      filteredRows.filter((r) => r.status === "completed" && !r.hasPrice)
        .length,
    [filteredRows]
  )

  function shiftMonth(delta: number): void {
    const shifted = getMonthBounds(year, month0 + delta)
    const y = Number(shifted.from.slice(0, 4))
    const m0 = Number(shifted.from.slice(5, 7)) - 1
    setYear(y)
    setMonth0(m0)
  }

  function goCurrentMonth(): void {
    setYear(currentYear)
    setMonth0(currentMonth0)
  }

  const createHref = `/finance/receipts/new?patientId=${encodeURIComponent(
    patientId
  )}&from=${period.from}&to=${period.to}`

  const showCreateButton = canCreateReceipt && unreceiptedCount > 0

  return (
    <div className="space-y-8">
      {/* --- Rides section --------------------------------------------------- */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-lg font-semibold tracking-tight">Fahrten</h3>
          {showCreateButton && (
            <Button asChild size="sm">
              <Link href={createHref}>
                <Receipt className="mr-2 h-4 w-4" />
                Quittung erstellen
              </Link>
            </Button>
          )}
        </div>

        {/* Period filter */}
        <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={mode === "month" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("month")}
            >
              Monat
            </Button>
            <Button
              type="button"
              variant={mode === "free" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("free")}
            >
              Frei
            </Button>
          </div>

          {mode === "month" ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => shiftMonth(-1)}
                aria-label="Vorheriger Monat"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[130px] text-center text-sm font-medium">
                {formatMonthLabel(year, month0)}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => shiftMonth(1)}
                aria-label="Nächster Monat"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={goCurrentMonth}
              >
                Aktueller Monat
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="period-from" className="text-xs">
                  Von
                </Label>
                <Input
                  id="period-from"
                  type="date"
                  value={freeFrom}
                  onChange={(e) => setFreeFrom(e.target.value)}
                  className="h-9 w-[160px]"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="period-to" className="text-xs">
                  Bis
                </Label>
                <Input
                  id="period-to"
                  type="date"
                  value={freeTo}
                  onChange={(e) => setFreeTo(e.target.value)}
                  className="h-9 w-[160px]"
                />
              </div>
              {!freeValid && (
                <p className="text-xs text-red-600">
                  Ungültiger Zeitraum (Von muss vor oder gleich Bis sein).
                </p>
              )}
            </div>
          )}
        </div>

        {/* Missing-price hint */}
        {missingPriceCount > 0 && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
            <span className="font-medium">Hinweis:</span> {missingPriceCount}{" "}
            abgeschlossene Fahrt(en) im Zeitraum ohne Preis – vor der Quittung
            pflegen.
          </div>
        )}

        <PatientRidesList rows={filteredRows} />

        {/* Period summary */}
        {filteredRows.length > 0 && (
          <div className="flex flex-wrap gap-6 rounded-md border bg-muted/50 px-4 py-3 text-sm">
            <div>
              <span className="text-muted-foreground">Fahrten:</span>{" "}
              <span className="font-medium">{filteredRows.length}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Summe:</span>{" "}
              <span className="font-medium">{formatChf(periodTotal)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">
                Unquittiert (abgeschlossen):
              </span>{" "}
              <span
                className={cn(
                  "font-medium",
                  unreceiptedCount > 0 && "text-amber-600"
                )}
              >
                {unreceiptedCount}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* --- Receipts section ------------------------------------------------ */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold tracking-tight">Quittungen</h3>
        <PatientReceiptsList receipts={receiptRows} />
      </section>
    </div>
  )
}
