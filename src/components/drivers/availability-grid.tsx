"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { saveWeeklyAvailability } from "@/actions/availability"
import {
  WEEKDAYS, SLOT_START_TIMES, WEEKDAY_LABELS, SLOT_LABELS,
} from "@/lib/validations/availability"
interface InitialSlot {
  day_of_week: string
  start_time: string
}

interface AvailabilityGridProps {
  driverId: string
  initialSlots: InitialSlot[]
}

function slotKey(day: string, time: string): string {
  return `${day}-${time}`
}

export function AvailabilityGrid({ driverId, initialSlots }: AvailabilityGridProps) {
  const [activeSlots, setActiveSlots] = useState<Set<string>>(
    () => new Set(initialSlots.map((s) => slotKey(s.day_of_week, s.start_time)))
  )
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function toggleSlot(day: string, time: string) {
    const key = slotKey(day, time)
    setActiveSlots((prev) => {
      const next = new Set(prev)
      if (next.has(key)) { next.delete(key) } else { next.add(key) }
      return next
    })
    setSaved(false)
  }

  function handleSave() {
    const slots = Array.from(activeSlots).map((key) => {
      const [day_of_week, start_time] = key.split("-") as [string, string]
      return { day_of_week, start_time }
    })

    startTransition(async () => {
      setError(null)
      const result = await saveWeeklyAvailability({ driver_id: driverId, slots })
      if (!result.success) {
        setError(result.error ?? "Fehler beim Speichern")
      } else {
        setSaved(true)
      }
    })
  }

  function selectAll() {
    const all = new Set<string>()
    for (const day of WEEKDAYS) {
      for (const time of SLOT_START_TIMES) {
        all.add(slotKey(day, time))
      }
    }
    setActiveSlots(all)
    setSaved(false)
  }

  function clearAll() {
    setActiveSlots(new Set())
    setSaved(false)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Wochenraster</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={selectAll} disabled={isPending}>Alle auswaehlen</Button>
            <Button variant="outline" size="sm" onClick={clearAll} disabled={isPending}>Alle entfernen</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
        {saved && <p className="mb-4 text-sm text-green-600">Verfuegbarkeit gespeichert.</p>}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="p-2 text-left text-sm font-medium" />
                {WEEKDAYS.map((day) => (
                  <th key={day} className="p-2 text-center text-sm font-medium">{WEEKDAY_LABELS[day]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SLOT_START_TIMES.map((time) => (
                <tr key={time}>
                  <td className="p-2 text-sm font-medium whitespace-nowrap">{SLOT_LABELS[time]}</td>
                  {WEEKDAYS.map((day) => {
                    const key = slotKey(day, time)
                    const isActive = activeSlots.has(key)
                    return (
                      <td key={key} className="p-1 text-center">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => toggleSlot(day, time)}
                          className={`h-10 w-full rounded-md border transition-colors ${
                            isActive
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted/30 border-border hover:bg-muted"
                          } ${isPending ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                          aria-label={`${WEEKDAY_LABELS[day]} ${SLOT_LABELS[time]}: ${isActive ? "aktiv" : "inaktiv"}`}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex gap-3">
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Speichert..." : "Speichern"}
          </Button>
          <span className="self-center text-sm text-muted-foreground">
            {activeSlots.size} von 25 Slots aktiv
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
