"use client"

import { useMemo, useState, useTransition } from "react"
import { Check } from "lucide-react"
import { saveWeeklyAvailability } from "@/actions/availability"
import {
  WEEKDAYS,
  SLOT_START_TIMES,
  WEEKDAY_LABELS,
  SLOT_LABELS,
} from "@/lib/validations/availability"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface InitialSlot {
  day_of_week: string
  start_time: string
}

interface WeeklyAvailabilityEditorProps {
  driverId: string
  initialSlots: InitialSlot[]
}

/** Slots the default suggestion pre-selects: mornings 08:00–12:00, Mon–Fri. */
const DEFAULT_SUGGESTION_TIMES = ["08:00", "10:00"] as const

function slotKey(day: string, time: string): string {
  return `${day}-${time}`
}

/**
 * Mobile-first weekly availability editor (Issue #100).
 *
 * One card per weekday (Mon–Fri, matching the DB `weekday_only` constraint on
 * recurring entries), each with five toggleable 2h slot chips. The fixed 2h
 * slot model means slots can never overlap, so no overlap validation is needed
 * here — the server + DB unique index guard against duplicates.
 *
 * "No chip selected on a day" simply means "not available that day": the
 * replace-all server action persists exactly the selected slots and deletes the
 * rest (create/delete model — there is no `is_active` flag anymore).
 */
export function WeeklyAvailabilityEditor({
  driverId,
  initialSlots,
}: WeeklyAvailabilityEditorProps): React.ReactElement {
  const { toast } = useToast()
  const [activeSlots, setActiveSlots] = useState<Set<string>>(
    () => new Set(initialSlots.map((s) => slotKey(s.day_of_week, s.start_time)))
  )
  const [isPending, startTransition] = useTransition()

  const isEmpty = activeSlots.size === 0

  const savedKeys = useMemo(
    () => new Set(initialSlots.map((s) => slotKey(s.day_of_week, s.start_time))),
    [initialSlots]
  )
  const isDirty = useMemo(() => {
    if (savedKeys.size !== activeSlots.size) return true
    for (const key of activeSlots) if (!savedKeys.has(key)) return true
    return false
  }, [activeSlots, savedKeys])

  function toggleSlot(day: string, time: string): void {
    const key = slotKey(day, time)
    setActiveSlots((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function applyDefaultSuggestion(): void {
    const next = new Set<string>()
    for (const day of WEEKDAYS) {
      for (const time of DEFAULT_SUGGESTION_TIMES) {
        next.add(slotKey(day, time))
      }
    }
    setActiveSlots(next)
  }

  function handleSave(): void {
    const slots = Array.from(activeSlots).map((key) => {
      const [day_of_week, start_time] = key.split("-") as [string, string]
      return { day_of_week, start_time }
    })

    startTransition(async () => {
      const result = await saveWeeklyAvailability({ driver_id: driverId, slots })
      if (result.success) {
        toast({
          title: "Gespeichert",
          description: "Ihr Wochenraster wurde aktualisiert.",
        })
      } else {
        toast({
          variant: "destructive",
          title: "Fehler",
          description: result.error ?? "Speichern fehlgeschlagen.",
        })
      }
    })
  }

  return (
    <div className="space-y-4">
      {isEmpty && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4">
          <p className="text-sm text-slate-600">
            Noch kein Wochenraster hinterlegt. Übernehmen Sie einen Vorschlag und
            passen Sie ihn an.
          </p>
          <button
            type="button"
            onClick={applyDefaultSuggestion}
            disabled={isPending}
            className="mt-3 inline-flex min-h-[44px] items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
          >
            Vorschlag: Mo–Fr, 08:00–12:00
          </button>
        </div>
      )}

      <ul className="space-y-3">
        {WEEKDAYS.map((day) => {
          const daySlots = SLOT_START_TIMES.filter((time) =>
            activeSlots.has(slotKey(day, time))
          )
          return (
            <li
              key={day}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="mb-3 flex items-baseline justify-between">
                <h3 className="text-base font-semibold text-slate-900">
                  {WEEKDAY_LABELS[day]}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {daySlots.length === 0
                    ? "nicht verfügbar"
                    : `${daySlots.length} Zeitfenster`}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {SLOT_START_TIMES.map((time) => {
                  const active = activeSlots.has(slotKey(day, time))
                  return (
                    <button
                      key={time}
                      type="button"
                      disabled={isPending}
                      onClick={() => toggleSlot(day, time)}
                      aria-pressed={active}
                      className={cn(
                        "flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border px-2 text-sm font-medium transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100",
                        isPending && "cursor-not-allowed opacity-60"
                      )}
                    >
                      {active && <Check className="h-4 w-4" aria-hidden="true" />}
                      {SLOT_LABELS[time]}
                    </button>
                  )
                })}
              </div>
            </li>
          )
        })}
      </ul>

      <div className="sticky bottom-24 z-10">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || !isDirty}
          className="flex h-12 w-full items-center justify-center rounded-lg bg-primary text-base font-semibold text-primary-foreground shadow-lg transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending
            ? "Wird gespeichert…"
            : isDirty
              ? "Wochenraster speichern"
              : "Gespeichert"}
        </button>
      </div>
    </div>
  )
}
