"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "@/hooks/use-toast"
import {
  loadBatchCandidates,
  executeReceiptBatch,
  type BatchRunResponse,
} from "@/actions/receipt-batch"
import { ReceiptBatchResult } from "@/components/finance/receipt-batch-result"
import { formatChf, formatDateShort, sumAmounts } from "@/lib/receipts/format"
import { getToday, getMondayOf, getSundayOf } from "@/lib/utils/dates"
import { cn } from "@/lib/utils"
import type { BatchCandidate } from "@/lib/receipts/batch-queries"

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

type QuickRange = "week" | "month"

export function ReceiptBatchForm(): React.ReactElement {
  const initialMonth = monthBounds()
  const [from, setFrom] = useState<string>(initialMonth.from)
  const [to, setTo] = useState<string>(initialMonth.to)

  const [candidates, setCandidates] = useState<BatchCandidate[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sendEmail, setSendEmail] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isRunning, startRun] = useTransition()
  const [result, setResult] = useState<BatchRunResponse | null>(null)
  const [emailRequested, setEmailRequested] = useState(false)

  const rangeValid = from !== "" && to !== "" && to >= from

  // Load candidates whenever the (valid) period changes — unless a run finished.
  useEffect(() => {
    if (result) return
    if (!rangeValid) {
      setCandidates([])
      setSelected(new Set())
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    loadBatchCandidates({ from, to })
      .then((res) => {
        if (cancelled) return
        if (!res.success) {
          setError(res.error ?? "Patienten konnten nicht geladen werden")
          setCandidates([])
          setSelected(new Set())
          return
        }
        setCandidates(res.data)
        // Pre-select every patient that has at least one billable ride.
        setSelected(
          new Set(res.data.filter((c) => c.rideCount > 0).map((c) => c.patientId))
        )
      })
      .catch(() => {
        if (!cancelled) setError("Patienten konnten nicht geladen werden")
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [from, to, rangeValid, result])

  const applyQuickRange = useCallback((range: QuickRange) => {
    const today = getToday()
    if (range === "week") {
      setFrom(getMondayOf(today))
      setTo(getSundayOf(today))
    } else {
      const m = monthBounds()
      setFrom(m.from)
      setTo(m.to)
    }
  }, [])

  const runnable = useMemo(
    () => candidates.filter((c) => c.rideCount > 0),
    [candidates]
  )

  const toggle = useCallback((patientId: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(patientId)
      else next.delete(patientId)
      return next
    })
  }, [])

  const allSelected =
    runnable.length > 0 && runnable.every((c) => selected.has(c.patientId))

  const toggleAll = useCallback(
    (checked: boolean) => {
      setSelected(
        checked ? new Set(runnable.map((c) => c.patientId)) : new Set()
      )
    },
    [runnable]
  )

  const selectedCandidates = useMemo(
    () => runnable.filter((c) => selected.has(c.patientId)),
    [runnable, selected]
  )
  const selectedTotal = useMemo(
    () => sumAmounts(selectedCandidates.map((c) => c.total)),
    [selectedCandidates]
  )
  const selectedRides = selectedCandidates.reduce((n, c) => n + c.rideCount, 0)
  const selectedWithEmail = selectedCandidates.filter((c) => c.hasEmail).length
  const pricelessPatients = candidates.filter((c) => c.pricelessCount > 0).length

  const handleRun = useCallback(() => {
    setConfirmOpen(false)
    const patientIds = selectedCandidates.map((c) => c.patientId)
    if (patientIds.length === 0) return
    const withEmail = sendEmail

    startRun(async () => {
      const res = await executeReceiptBatch({ from, to, patientIds, sendEmail })
      if (!res.success) {
        setError(res.error ?? "Der Sammellauf ist fehlgeschlagen")
        return
      }
      setEmailRequested(withEmail)
      setResult(res.data)
      toast({
        title: "Sammellauf abgeschlossen",
        description: `${res.data.issuedCount} Quittung(en) ausgestellt${
          res.data.failedCount > 0 ? `, ${res.data.failedCount} fehlgeschlagen` : ""
        }.`,
      })
    })
  }, [selectedCandidates, from, to, sendEmail])

  // Result view replaces the form once the run finished.
  if (result) {
    return <ReceiptBatchResult result={result} emailRequested={emailRequested} />
  }

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

      {/* Period */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Zeitraum</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Schnellwahl</Label>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
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
              <Label htmlFor="batch-from">Von</Label>
              <Input
                id="batch-from"
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="batch-to">Bis</Label>
              <Input
                id="batch-to"
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

      {/* Candidates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Patienten mit quittierbaren Fahrten
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Patienten werden geladen...
            </div>
          ) : candidates.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Keine quittierbaren Fahrten in diesem Zeitraum.
            </p>
          ) : (
            <div className="space-y-3">
              {pricelessPatients > 0 && (
                <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Bei {pricelessPatients} Patient(en) gibt es Fahrten ohne Preis.
                  Diese fliessen nicht in den Sammellauf ein und müssen zuerst
                  gepflegt werden.
                </p>
              )}

              {/* Header */}
              <div className="flex items-center gap-3 border-b pb-2 text-xs font-medium text-muted-foreground">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(c) => toggleAll(c === true)}
                  aria-label="Alle auswählen"
                  disabled={runnable.length === 0}
                />
                <span className="flex-1">Patient</span>
                <span className="w-16 text-right">Fahrten</span>
                <span className="w-24 text-right">Betrag</span>
                <span className="w-14 text-center">E-Mail</span>
              </div>

              <ul className="space-y-1">
                {candidates.map((c) => {
                  const runnableRow = c.rideCount > 0
                  const isChecked = selected.has(c.patientId)
                  return (
                    <li
                      key={c.patientId}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-1 py-2 text-sm",
                        !runnableRow && "opacity-60"
                      )}
                    >
                      <Checkbox
                        checked={isChecked}
                        disabled={!runnableRow}
                        onCheckedChange={(ch) => toggle(c.patientId, ch === true)}
                        aria-label={`${c.patientName} auswählen`}
                      />
                      <span className="flex-1">
                        {c.patientName}
                        {c.pricelessCount > 0 && (
                          <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                            {c.pricelessCount} ohne Preis
                          </span>
                        )}
                      </span>
                      <span className="w-16 text-right tabular-nums">
                        {c.rideCount}
                      </span>
                      <span className="w-24 text-right tabular-nums">
                        {c.rideCount > 0 ? formatChf(c.total) : "–"}
                      </span>
                      <span className="w-14 text-center text-muted-foreground">
                        {c.hasEmail ? "✓" : "–"}
                      </span>
                    </li>
                  )
                })}
              </ul>

              {/* Totals */}
              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-sm text-muted-foreground">
                  {selectedCandidates.length} Patient(en) · {selectedRides}{" "}
                  Fahrt(en) ausgewählt
                </span>
                <span className="text-lg font-semibold">
                  {formatChf(selectedTotal)}
                </span>
              </div>

              {/* Optional e-mail */}
              <label className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <Checkbox
                  checked={sendEmail}
                  onCheckedChange={(c) => setSendEmail(c === true)}
                  aria-label="Quittungen zusätzlich per E-Mail senden"
                  className="mt-0.5"
                />
                <span>
                  Quittungen zusätzlich per E-Mail senden
                  <span className="block text-xs text-muted-foreground">
                    An Patienten mit hinterlegter E-Mail ({selectedWithEmail} von{" "}
                    {selectedCandidates.length}). Übrige erhalten nur den Ausdruck.
                    Die medizinischen Details stehen ausschliesslich im PDF-Anhang.
                  </span>
                </span>
              </label>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={isRunning || selectedCandidates.length === 0}
        >
          {isRunning && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          )}
          {isRunning
            ? "Sammellauf läuft..."
            : `Sammellauf starten (${selectedCandidates.length})`}
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sammellauf starten?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <span className="block">
                  Für {selectedCandidates.length} Patient(en) wird je eine Quittung
                  ausgestellt ({selectedRides} Fahrt(en), Gesamtbetrag{" "}
                  {formatChf(selectedTotal)}) für den Zeitraum{" "}
                  {formatDateShort(from)} – {formatDateShort(to)}.
                </span>
                {sendEmail && (
                  <span className="block font-medium text-foreground">
                    {selectedWithEmail} Patient(en) mit hinterlegter E-Mail erhalten
                    die Quittung zusätzlich per Mail (PDF im Anhang).
                  </span>
                )}
                <span className="block text-xs">
                  Ausgestellte Quittungen sind fortlaufend nummeriert und können nur
                  storniert, nicht gelöscht werden.
                </span>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleRun}>
              Sammellauf starten
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
