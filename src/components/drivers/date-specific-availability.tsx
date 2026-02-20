"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { saveDateSpecificAvailability } from "@/actions/availability"
import { SLOT_START_TIMES, SLOT_LABELS } from "@/lib/validations/availability"

interface DateSpecificSlot {
  specific_date: string
  start_time: string
}

interface DateSpecificAvailabilityProps {
  driverId: string
  initialSlots: DateSpecificSlot[]
}

/** Format YYYY-MM-DD to DD.MM.YYYY for display */
function formatDateDE(dateStr: string): string {
  const [year, month, day] = dateStr.split("-") as [string, string, string]
  return `${day}.${month}.${year}`
}

/** Get today's date as YYYY-MM-DD */
function todayISO(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/** Group slots by date, sorted ascending */
function groupByDate(slots: DateSpecificSlot[]): Map<string, string[]> {
  const grouped = new Map<string, string[]>()
  for (const slot of slots) {
    const existing = grouped.get(slot.specific_date)
    if (existing) {
      existing.push(slot.start_time)
    } else {
      grouped.set(slot.specific_date, [slot.start_time])
    }
  }
  // Sort each date's slots
  for (const times of grouped.values()) {
    times.sort()
  }
  // Return sorted by date
  return new Map([...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)))
}

export function DateSpecificAvailability({
  driverId,
  initialSlots,
}: DateSpecificAvailabilityProps) {
  const [selectedDate, setSelectedDate] = useState("")
  const [activeSlots, setActiveSlots] = useState<Set<string>>(new Set())
  const [existingSlots, setExistingSlots] = useState<DateSpecificSlot[]>(initialSlots)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function handleDateChange(date: string) {
    setSelectedDate(date)
    setSaved(false)
    setError(null)

    // Load existing slots for this date
    const existingForDate = existingSlots
      .filter((s) => s.specific_date === date)
      .map((s) => s.start_time)
    setActiveSlots(new Set(existingForDate))
  }

  function toggleSlot(time: string) {
    setActiveSlots((prev) => {
      const next = new Set(prev)
      if (next.has(time)) {
        next.delete(time)
      } else {
        next.add(time)
      }
      return next
    })
    setSaved(false)
  }

  function handleSave() {
    if (!selectedDate) return

    const slots = Array.from(activeSlots)

    startTransition(async () => {
      setError(null)
      const result = await saveDateSpecificAvailability({
        driver_id: driverId,
        specific_date: selectedDate,
        slots,
      })
      if (!result.success) {
        setError(result.error ?? "Fehler beim Speichern")
      } else {
        setSaved(true)
        // Update local state to reflect saved data
        setExistingSlots((prev) => {
          const filtered = prev.filter((s) => s.specific_date !== selectedDate)
          const newSlots = slots.map((start_time) => ({
            specific_date: selectedDate,
            start_time,
          }))
          return [...filtered, ...newSlots]
        })
      }
    })
  }

  function handleDeleteDate(date: string) {
    startTransition(async () => {
      setError(null)
      const result = await saveDateSpecificAvailability({
        driver_id: driverId,
        specific_date: date,
        slots: [],
      })
      if (!result.success) {
        setError(result.error ?? "Fehler beim Loeschen")
      } else {
        // Remove from local state
        setExistingSlots((prev) => prev.filter((s) => s.specific_date !== date))
        // If the deleted date was selected, clear the selection
        if (selectedDate === date) {
          setActiveSlots(new Set())
        }
      }
    })
  }

  const grouped = groupByDate(existingSlots)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Datumsspezifische Verfuegbarkeit</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {saved && (
          <p className="text-sm text-green-600">
            Verfuegbarkeit fuer {formatDateDE(selectedDate)} gespeichert.
          </p>
        )}

        {/* Date selection */}
        <div className="space-y-2">
          <Label htmlFor="specific-date">Datum auswaehlen</Label>
          <Input
            id="specific-date"
            type="date"
            min={todayISO()}
            value={selectedDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="max-w-xs"
            disabled={isPending}
          />
        </div>

        {/* Slot toggle buttons - only visible when date is selected */}
        {selectedDate && (
          <div className="space-y-4">
            <p className="text-sm font-medium">
              Zeitfenster fuer {formatDateDE(selectedDate)}
            </p>
            <div className="flex flex-wrap gap-2">
              {SLOT_START_TIMES.map((time) => {
                const isActive = activeSlots.has(time)
                return (
                  <button
                    key={time}
                    type="button"
                    disabled={isPending}
                    onClick={() => toggleSlot(time)}
                    className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/30 border-border hover:bg-muted"
                    } ${isPending ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    aria-label={`${SLOT_LABELS[time]}: ${isActive ? "aktiv" : "inaktiv"}`}
                  >
                    {SLOT_LABELS[time]}
                  </button>
                )
              })}
            </div>

            <div className="flex gap-3">
              <Button onClick={handleSave} disabled={isPending}>
                {isPending ? "Speichert..." : "Speichern"}
              </Button>
              <span className="self-center text-sm text-muted-foreground">
                {activeSlots.size} von 5 Slots aktiv
              </span>
            </div>
          </div>
        )}

        {/* Existing date-specific slots */}
        {grouped.size > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Bestehende Einmal-Verfuegbarkeiten</h3>
            <div className="space-y-2">
              {Array.from(grouped.entries()).map(([date, times]) => (
                <div
                  key={date}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <span className="font-medium">{formatDateDE(date)}</span>
                    <span className="ml-3 text-sm text-muted-foreground">
                      {times
                        .map((t) => SLOT_LABELS[t as keyof typeof SLOT_LABELS])
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleDateChange(date)}
                    >
                      Bearbeiten
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleDeleteDate(date)}
                    >
                      Loeschen
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
