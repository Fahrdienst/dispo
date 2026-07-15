"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  EntityCombobox,
  type ComboboxItem,
} from "@/components/shared/entity-combobox"
import { toast } from "@/hooks/use-toast"
import { loadBillableRides, issueReceipt } from "@/actions/receipt-create"
import { formatAmount, formatChf, formatDateShort, formatKm, sumAmounts } from "@/lib/receipts/format"
import { getToday, getMondayOf, getSundayOf } from "@/lib/utils/dates"
import { cn } from "@/lib/utils"
import type { BillableRide } from "@/lib/receipts/types"

interface ReceiptCreateFormProps {
  patients: ComboboxItem[]
  defaultPatientId: string | null
  defaultFrom: string | null
  defaultTo: string | null
}

/** First / last day of the current month as YYYY-MM-DD. */
function monthBounds(): { from: string; to: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const pad = (n: number): string => String(n).padStart(2, "0")
  const lastDay = new Date(y, m + 1, 0).getDate()
  return {
    from: `${y}-${pad(m + 1)}-01`,
    to: `${y}-${pad(m + 1)}-${pad(lastDay)}`,
  }
}

type QuickRange = "day" | "week" | "month"

export function ReceiptCreateForm({
  patients,
  defaultPatientId,
  defaultFrom,
  defaultTo,
}: ReceiptCreateFormProps) {
  const router = useRouter()
  const [isSubmitting, startSubmit] = useTransition()

  const initialMonth = monthBounds()
  const [patientId, setPatientId] = useState<string | null>(defaultPatientId)
  const [from, setFrom] = useState<string>(defaultFrom ?? initialMonth.from)
  const [to, setTo] = useState<string>(defaultTo ?? initialMonth.to)

  const [rides, setRides] = useState<BillableRide[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rangeValid = from !== "" && to !== "" && to >= from
  const canQuery = patientId != null && rangeValid

  // Load the billable-ride preview whenever patient or period changes.
  useEffect(() => {
    if (!canQuery || patientId == null) {
      setRides([])
      setSelected(new Set())
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    loadBillableRides({ patientId, from, to })
      .then((result) => {
        if (cancelled) return
        if (!result.success) {
          setError(result.error ?? "Fahrten konnten nicht geladen werden")
          setRides([])
          setSelected(new Set())
          return
        }
        setRides(result.data)
        // Pre-select all priced rides; priceless ones stay unselectable.
        setSelected(
          new Set(result.data.filter((r) => r.amount != null).map((r) => r.id))
        )
      })
      .catch(() => {
        if (!cancelled) setError("Fahrten konnten nicht geladen werden")
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [patientId, from, to, canQuery])

  const applyQuickRange = useCallback((range: QuickRange) => {
    const today = getToday()
    if (range === "day") {
      setFrom(today)
      setTo(today)
    } else if (range === "week") {
      setFrom(getMondayOf(today))
      setTo(getSundayOf(today))
    } else {
      const m = monthBounds()
      setFrom(m.from)
      setTo(m.to)
    }
  }, [])

  const toggleRide = useCallback((rideId: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(rideId)
      else next.delete(rideId)
      return next
    })
  }, [])

  const selectableRides = useMemo(
    () => rides.filter((r) => r.amount != null),
    [rides]
  )
  const allSelected =
    selectableRides.length > 0 && selectableRides.every((r) => selected.has(r.id))

  const toggleAll = useCallback(
    (checked: boolean) => {
      setSelected(
        checked ? new Set(selectableRides.map((r) => r.id)) : new Set()
      )
    },
    [selectableRides]
  )

  const total = useMemo(
    () =>
      sumAmounts(
        rides.filter((r) => selected.has(r.id)).map((r) => r.amount)
      ),
    [rides, selected]
  )

  const pricelessCount = rides.length - selectableRides.length
  const selectedCount = selected.size

  const handleSubmit = useCallback(() => {
    setError(null)
    if (patientId == null) {
      setError("Bitte einen Patienten auswählen")
      return
    }
    if (!rangeValid) {
      setError("Bitte einen gültigen Zeitraum wählen")
      return
    }
    if (selectedCount === 0) {
      setError("Bitte mindestens eine Fahrt auswählen")
      return
    }

    startSubmit(async () => {
      const result = await issueReceipt({
        patientId,
        from,
        to,
        rideIds: Array.from(selected),
      })

      if (!result.success) {
        setError(result.error ?? "Die Quittung konnte nicht ausgestellt werden")
        return
      }

      toast({
        title: `Quittung ${result.data.receiptNumber} ausgestellt`,
        description: result.data.pdfGenerated
          ? "Der Beleg wurde erstellt und das PDF erzeugt."
          : undefined,
      })

      if (!result.data.pdfGenerated) {
        toast({
          variant: "destructive",
          title: "PDF nicht erzeugt",
          description:
            "Die Quittung wurde ausgestellt, aber das PDF konnte nicht erzeugt werden. Es lässt sich später neu erzeugen.",
        })
      }

      router.push(`/finance/receipts?created=${result.data.receiptId}`)
    })
  }, [patientId, from, to, rangeValid, selectedCount, selected, router])

  return (
    <div className="space-y-6">
      {error && (
        <p
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}

      {/* Patient + period */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Patient &amp; Zeitraum</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="receipt-patient">Patient</Label>
            <EntityCombobox
              items={patients}
              value={patientId}
              onChange={setPatientId}
              placeholder="Patient suchen..."
              emptyMessage="Kein Patient gefunden"
              aria-label="Patient auswählen"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Schnellwahl</Label>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { value: "day" as const, label: "Heute" },
                  { value: "week" as const, label: "Diese Woche" },
                  { value: "month" as const, label: "Dieser Monat" },
                ]
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => applyQuickRange(opt.value)}
                  className="rounded-md border border-input bg-white px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring/40"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="receipt-from">Von</Label>
              <Input
                id="receipt-from"
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="receipt-to">Bis</Label>
              <Input
                id="receipt-to"
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>
          {!rangeValid && from !== "" && to !== "" && (
            <p className="text-sm text-destructive">
              Das Bis-Datum darf nicht vor dem Von-Datum liegen.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quittierbare Fahrten</CardTitle>
        </CardHeader>
        <CardContent>
          {patientId == null ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Bitte zuerst einen Patienten und Zeitraum wählen.
            </p>
          ) : isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Fahrten werden geladen...
            </div>
          ) : rides.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Keine quittierbaren Fahrten in diesem Zeitraum.
            </p>
          ) : (
            <div className="space-y-3">
              {pricelessCount > 0 && (
                <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {pricelessCount} Fahrt(en) ohne Preis sind nicht auswählbar und
                  müssen zuerst gepflegt werden.
                </p>
              )}

              {/* Header row */}
              <div className="flex items-center gap-3 border-b pb-2 text-xs font-medium text-muted-foreground">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(c) => toggleAll(c === true)}
                  aria-label="Alle auswählen"
                  disabled={selectableRides.length === 0}
                />
                <span className="w-20">Datum</span>
                <span className="flex-1">Fahrt</span>
                <span className="w-16 text-right">km</span>
                <span className="w-20 text-right">Betrag</span>
              </div>

              {/* Ride rows */}
              <ul className="space-y-1">
                {rides.map((ride) => {
                  const priceless = ride.amount == null
                  const isChecked = selected.has(ride.id)
                  return (
                    <li
                      key={ride.id}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-1 py-2 text-sm",
                        priceless && "opacity-60"
                      )}
                    >
                      <Checkbox
                        checked={isChecked}
                        disabled={priceless}
                        onCheckedChange={(c) => toggleRide(ride.id, c === true)}
                        aria-label={`Fahrt vom ${formatDateShort(ride.date)} auswählen`}
                      />
                      <span className="w-20 tabular-nums">
                        {formatDateShort(ride.date)}
                      </span>
                      <span className="flex-1">
                        {ride.description}
                        {priceless && (
                          <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                            ohne Preis
                          </span>
                        )}
                      </span>
                      <span className="w-16 text-right tabular-nums text-muted-foreground">
                        {formatKm(ride.distanceKm)}
                      </span>
                      <span className="w-20 text-right tabular-nums">
                        {ride.amount != null ? formatAmount(ride.amount) : "–"}
                      </span>
                    </li>
                  )
                })}
              </ul>

              {/* Live total */}
              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-sm text-muted-foreground">
                  {selectedCount} Fahrt(en) ausgewählt
                </span>
                <span className="text-lg font-semibold">{formatChf(total)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/finance/receipts")}
          disabled={isSubmitting}
        >
          Abbrechen
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || selectedCount === 0}
        >
          {isSubmitting && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          )}
          {isSubmitting ? "Wird ausgestellt..." : "Quittung ausstellen"}
        </Button>
      </div>
    </div>
  )
}
