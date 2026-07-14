"use client"

import { useMemo, useState, useTransition } from "react"
import { CalendarPlus, Trash2 } from "lucide-react"
import { saveDateSpecificAvailability } from "@/actions/availability"
import { SLOT_START_TIMES, SLOT_LABELS } from "@/lib/validations/availability"
import {
  resolveAvailability,
  type AvailabilityEntry,
  type Weekday,
} from "@/lib/availability/resolve"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface WeeklySlot {
  day_of_week: string
  start_time: string
}

interface DateSlot {
  specific_date: string
  start_time: string
}

interface DateExceptionEditorProps {
  driverId: string
  /** Weekly grid slots, used only to show the "grid says…" override context. */
  weeklySlots: WeeklySlot[]
  initialDateSlots: DateSlot[]
}

/** Compute end_time (start + 2h) for the fixed slot model, "HH:MM". */
function slotEnd(start: string): string {
  const hour = Number(start.slice(0, 2))
  return `${String(hour + 2).padStart(2, "0")}:00`
}

/** Local YYYY-MM-DD for the date input `min` (no UTC shift for "today"). */
function todayISO(): string {
  const now = new Date()
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-")
}

/** Format YYYY-MM-DD to DD.MM.YYYY. */
function formatDateDE(iso: string): string {
  const [year, month, day] = iso.split("-") as [string, string, string]
  return `${day}.${month}.${year}`
}

function groupByDate(slots: DateSlot[]): Map<string, string[]> {
  const grouped = new Map<string, string[]>()
  for (const slot of slots) {
    const times = grouped.get(slot.specific_date) ?? []
    times.push(slot.start_time)
    grouped.set(slot.specific_date, times)
  }
  for (const times of grouped.values()) times.sort()
  return new Map([...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)))
}

/**
 * Mobile-first date-specific availability editor (Issue #101).
 *
 * A date exception fully overrides the weekly grid for that single date
 * (precedence rule of #101 — see `resolveAvailability`). Saving a date with no
 * slots removes the exception, so the day reverts to the weekly grid. To be
 * fully unavailable on a working day, drivers use the Abwesenheiten feature; the
 * fixed-slot schema cannot store an "empty exception" marker.
 */
export function DateExceptionEditor({
  driverId,
  weeklySlots,
  initialDateSlots,
}: DateExceptionEditorProps): React.ReactElement {
  const { toast } = useToast()
  const [selectedDate, setSelectedDate] = useState("")
  const [activeSlots, setActiveSlots] = useState<Set<string>>(new Set())
  const [existing, setExisting] = useState<DateSlot[]>(initialDateSlots)
  const [isPending, startTransition] = useTransition()

  // Weekly grid as resolver entries, so we can reuse resolveAvailability to show
  // the driver what the grid would otherwise yield for the picked date.
  const weeklyEntries = useMemo<AvailabilityEntry[]>(
    () =>
      weeklySlots.map((s) => ({
        kind: "weekly",
        dayOfWeek: s.day_of_week as Weekday,
        start: s.start_time,
        end: slotEnd(s.start_time),
      })),
    [weeklySlots]
  )

  const gridWindows = useMemo(
    () => (selectedDate ? resolveAvailability(selectedDate, weeklyEntries) : []),
    [selectedDate, weeklyEntries]
  )

  const grouped = groupByDate(existing)

  function loadDate(date: string): void {
    setSelectedDate(date)
    const forDate = existing
      .filter((s) => s.specific_date === date)
      .map((s) => s.start_time)
    setActiveSlots(new Set(forDate))
  }

  function toggleSlot(time: string): void {
    setActiveSlots((prev) => {
      const next = new Set(prev)
      if (next.has(time)) next.delete(time)
      else next.add(time)
      return next
    })
  }

  function persist(date: string, slots: string[], successText: string): void {
    startTransition(async () => {
      const result = await saveDateSpecificAvailability({
        driver_id: driverId,
        specific_date: date,
        slots,
      })
      if (result.success) {
        setExisting((prev) => {
          const withoutDate = prev.filter((s) => s.specific_date !== date)
          const added = slots.map((start_time) => ({
            specific_date: date,
            start_time,
          }))
          return [...withoutDate, ...added]
        })
        toast({ title: "Gespeichert", description: successText })
      } else {
        toast({
          variant: "destructive",
          title: "Fehler",
          description: result.error ?? "Speichern fehlgeschlagen.",
        })
      }
    })
  }

  function handleSave(): void {
    if (!selectedDate) return
    persist(
      selectedDate,
      Array.from(activeSlots),
      activeSlots.size === 0
        ? `Ausnahme für ${formatDateDE(selectedDate)} entfernt.`
        : `Ausnahme für ${formatDateDE(selectedDate)} gespeichert.`
    )
  }

  function handleDelete(date: string): void {
    persist(date, [], `Ausnahme für ${formatDateDE(date)} entfernt.`)
    if (selectedDate === date) {
      setSelectedDate("")
      setActiveSlots(new Set())
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <label
          htmlFor="exception-date"
          className="mb-2 block text-sm font-medium text-slate-900"
        >
          Datum auswählen
        </label>
        <input
          id="exception-date"
          type="date"
          min={todayISO()}
          value={selectedDate}
          onChange={(e) => loadDate(e.target.value)}
          disabled={isPending}
          className="h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />

        {selectedDate && (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-slate-600">
              {gridWindows.length > 0 ? (
                <>
                  Laut Wochenraster:{" "}
                  {gridWindows.map((w) => `${w.start}–${w.end}`).join(", ")}. Diese
                  Ausnahme ersetzt das Raster für diesen Tag.
                </>
              ) : (
                "Für diesen Wochentag ist kein Raster hinterlegt. Diese Ausnahme legt die Verfügbarkeit fest."
              )}
            </p>

            <div className="grid grid-cols-2 gap-2">
              {SLOT_START_TIMES.map((time) => {
                const active = activeSlots.has(time)
                return (
                  <button
                    key={time}
                    type="button"
                    disabled={isPending}
                    onClick={() => toggleSlot(time)}
                    aria-pressed={active}
                    className={cn(
                      "flex min-h-[44px] items-center justify-center rounded-lg border px-2 text-sm font-medium transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100",
                      isPending && "cursor-not-allowed opacity-60"
                    )}
                  >
                    {SLOT_LABELS[time]}
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              <CalendarPlus className="h-5 w-5" aria-hidden="true" />
              {isPending
                ? "Wird gespeichert…"
                : activeSlots.size === 0
                  ? "Ausnahme entfernen"
                  : "Ausnahme speichern"}
            </button>
          </div>
        )}
      </div>

      {grouped.size > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">
            Bestehende Ausnahmen
          </h3>
          <ul className="space-y-2">
            {Array.from(grouped.entries()).map(([date, times]) => (
              <li
                key={date}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3"
              >
                <button
                  type="button"
                  onClick={() => loadDate(date)}
                  disabled={isPending}
                  className="min-h-[44px] flex-1 text-left disabled:opacity-50"
                >
                  <span className="block font-medium text-slate-900">
                    {formatDateDE(date)}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {times
                      .map((t) => SLOT_LABELS[t as keyof typeof SLOT_LABELS])
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(date)}
                  disabled={isPending}
                  aria-label={`Ausnahme für ${formatDateDE(date)} löschen`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                >
                  <Trash2 className="h-5 w-5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
