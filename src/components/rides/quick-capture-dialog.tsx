"use client"

import { useState, useEffect, useCallback, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  EntityCombobox,
  type ComboboxItem,
} from "@/components/shared/entity-combobox"
import { getPatientsList, getDestinationsList } from "@/actions/combobox"
import { quickCreateRide } from "@/actions/quick-capture"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface QuickCaptureDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pre-fill the date (YYYY-MM-DD) */
  defaultDate?: string
}

type Direction = "outbound" | "return" | "both"

const DIRECTION_OPTIONS: { value: Direction; label: string }[] = [
  { value: "outbound", label: "Hinfahrt" },
  { value: "return", label: "Rueckfahrt" },
  { value: "both", label: "Hin + Rueck" },
]

export function QuickCaptureDialog({
  open,
  onOpenChange,
  defaultDate,
}: QuickCaptureDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Data
  const [patients, setPatients] = useState<ComboboxItem[]>([])
  const [destinations, setDestinations] = useState<ComboboxItem[]>([])
  const [dataLoaded, setDataLoaded] = useState(false)

  type DurationCat = "under_2h" | "over_2h"

  // Form state
  const [patientId, setPatientId] = useState<string | null>(null)
  const [destinationId, setDestinationId] = useState<string | null>(null)
  const [date, setDate] = useState(
    defaultDate ?? new Date().toISOString().split("T")[0] ?? ""
  )
  const [pickupTime, setPickupTime] = useState("")
  const [direction, setDirection] = useState<Direction>("outbound")
  const [durationCategory, setDurationCategory] = useState<DurationCat>("under_2h")
  const [error, setError] = useState<string | null>(null)

  // Load combobox data when dialog opens
  useEffect(() => {
    if (!open) return
    if (dataLoaded) return

    let cancelled = false
    async function loadData() {
      const [patientData, destData] = await Promise.all([
        getPatientsList(),
        getDestinationsList(),
      ])
      if (cancelled) return
      setPatients(patientData)
      setDestinations(destData)
      setDataLoaded(true)
    }

    loadData()
    return () => {
      cancelled = true
    }
  }, [open, dataLoaded])

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setPatientId(null)
      setDestinationId(null)
      setDate(
        defaultDate ?? new Date().toISOString().split("T")[0] ?? ""
      )
      setPickupTime("")
      setDirection("outbound")
      setDurationCategory("under_2h")
      setError(null)
    }
  }, [open, defaultDate])

  const handleSubmit = useCallback(() => {
    setError(null)

    if (!patientId) {
      setError("Bitte Patient auswaehlen")
      return
    }
    if (!destinationId) {
      setError("Bitte Ziel auswaehlen")
      return
    }
    if (!date) {
      setError("Bitte Datum eingeben")
      return
    }
    if (!pickupTime) {
      setError("Bitte Abholzeit eingeben")
      return
    }

    startTransition(async () => {
      const result = await quickCreateRide({
        patient_id: patientId,
        destination_id: destinationId,
        date,
        pickup_time: pickupTime,
        direction,
        duration_category: durationCategory,
      })

      if (!result.success) {
        setError(result.error ?? "Fahrt konnte nicht erstellt werden")
        return
      }

      toast({
        title: "Fahrt erstellt",
        description:
          direction === "both"
            ? "Hin- und Rueckfahrt wurden angelegt."
            : "Die Fahrt wurde erfolgreich angelegt.",
      })

      onOpenChange(false)
      router.refresh()
    })
  }, [patientId, destinationId, date, pickupTime, direction, durationCategory, onOpenChange, router])

  // Handle Enter key on the form to submit
  const handleFormKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Only submit if Enter is pressed on an input (not inside combobox dropdown)
      if (
        e.key === "Enter" &&
        (e.target instanceof HTMLInputElement) &&
        e.target.type !== "text" // text inputs are combobox - don't submit from those
      ) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[400px] gap-5 p-5"
        onKeyDown={handleFormKeyDown}
      >
        <DialogHeader>
          <DialogTitle>Schnellerfassung</DialogTitle>
          <DialogDescription>
            Fahrt mit minimalen Angaben erfassen
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="space-y-4">
          {/* 1. Patient */}
          <div className="space-y-1.5">
            <Label htmlFor="qc-patient">Patient</Label>
            <EntityCombobox
              items={patients}
              value={patientId}
              onChange={setPatientId}
              placeholder="Patient suchen..."
              emptyMessage="Kein Patient gefunden"
              autoFocus
              aria-label="Patient auswaehlen"
            />
          </div>

          {/* 2. Destination */}
          <div className="space-y-1.5">
            <Label htmlFor="qc-destination">Ziel</Label>
            <EntityCombobox
              items={destinations}
              value={destinationId}
              onChange={setDestinationId}
              placeholder="Ziel suchen..."
              emptyMessage="Kein Ziel gefunden"
              aria-label="Ziel auswaehlen"
            />
          </div>

          {/* 3. Date */}
          <div className="space-y-1.5">
            <Label htmlFor="qc-date">Datum</Label>
            <Input
              id="qc-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-11"
            />
          </div>

          {/* 4. Pickup Time */}
          <div className="space-y-1.5">
            <Label htmlFor="qc-time">Abholzeit</Label>
            <Input
              id="qc-time"
              type="time"
              value={pickupTime}
              onChange={(e) => setPickupTime(e.target.value)}
              className="h-11"
            />
          </div>

          {/* 5. Direction Toggle */}
          <div className="space-y-1.5">
            <Label>Richtung</Label>
            <div className="flex gap-1.5">
              {DIRECTION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDirection(opt.value)}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                    "min-h-[44px]",
                    "focus:outline-none focus:ring-2 focus:ring-ring/40 focus:ring-offset-1",
                    direction === opt.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input bg-white text-muted-foreground hover:bg-muted/50"
                  )}
                  aria-pressed={direction === opt.value}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 6. Duration Category Toggle */}
          <div className="space-y-1.5">
            <Label>Aufenthaltsdauer</Label>
            <div className="flex gap-1.5">
              {([
                { value: "under_2h" as const, label: "Bis 1 Std." },
                { value: "over_2h" as const, label: "Ab 2 Std." },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDurationCategory(opt.value)}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                    "min-h-[44px]",
                    "focus:outline-none focus:ring-2 focus:ring-ring/40 focus:ring-offset-1",
                    durationCategory === opt.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input bg-white text-muted-foreground hover:bg-muted/50"
                  )}
                  aria-pressed={durationCategory === opt.value}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="flex-1"
          >
            {isPending && (
              <Loader2
                className="mr-2 h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            )}
            {isPending ? "Wird erstellt..." : "Fahrt erstellen"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Abbrechen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
