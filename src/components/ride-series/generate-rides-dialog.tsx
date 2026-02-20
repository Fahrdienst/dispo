"use client"

import { useEffect } from "react"
import { useFormState } from "react-dom"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { SubmitButton } from "@/components/shared/submit-button"
import { generateRidesFromSeries } from "@/actions/ride-series"

interface GenerateRidesDialogProps {
  seriesId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function getToday(): string {
  return new Date().toISOString().split("T")[0]!
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + "T00:00:00")
  date.setDate(date.getDate() + days)
  return date.toISOString().split("T")[0]!
}

export function GenerateRidesDialog({
  seriesId,
  open,
  onOpenChange,
}: GenerateRidesDialogProps) {
  const [state, formAction] = useFormState(generateRidesFromSeries, null)

  const today = getToday()
  const defaultToDate = addDays(today, 14)

  const isSuccess = state?.success === true
  const count = isSuccess ? state.data.count : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fahrten generieren</DialogTitle>
          <DialogDescription>
            Generieren Sie Einzelfahrten aus dieser Fahrtserie fuer einen
            bestimmten Zeitraum. Bereits existierende Fahrten werden
            uebersprungen.
          </DialogDescription>
        </DialogHeader>

        {isSuccess ? (
          <div className="space-y-4">
            <p className="text-sm">
              {count === 0
                ? "Keine neuen Fahrten generiert. Alle Fahrten existieren bereits."
                : `${count} Fahrt${count === 1 ? "" : "en"} generiert.`}
            </p>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Schliessen</Button>
            </DialogFooter>
          </div>
        ) : (
          <form action={formAction}>
            <div className="space-y-4">
              {state && !state.success && state.error && (
                <p className="text-sm text-destructive">{state.error}</p>
              )}

              <input type="hidden" name="series_id" value={seriesId ?? ""} />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="from_date">Von</Label>
                  <Input
                    id="from_date"
                    name="from_date"
                    type="date"
                    required
                    defaultValue={today}
                  />
                  {state &&
                    !state.success &&
                    state.fieldErrors?.from_date && (
                      <p className="text-sm text-destructive">
                        {state.fieldErrors.from_date[0]}
                      </p>
                    )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="to_date">Bis</Label>
                  <Input
                    id="to_date"
                    name="to_date"
                    type="date"
                    required
                    defaultValue={defaultToDate}
                  />
                  {state && !state.success && state.fieldErrors?.to_date && (
                    <p className="text-sm text-destructive">
                      {state.fieldErrors.to_date[0]}
                    </p>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Abbrechen
                </Button>
                <SubmitButton pendingText="Generiere...">
                  Generieren
                </SubmitButton>
              </DialogFooter>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
