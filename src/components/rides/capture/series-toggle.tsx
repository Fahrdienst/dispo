"use client"

// SLOT (#136): Wiederhol-/Serien-Toggle für die Fahrt-Erfassung.
//
// Blendet bei aktivem "Wiederholen"-Schalter die Serienfelder ein
// (Wiederholungs-Typ, Wochentage, Enddatum) und zeigt eine Vorschau der Anzahl
// generierter Fahrten. Nutzt das bestehende Fahrtserien-Modell/-Muster aus
// `ride-form.tsx`:
//   - `enable_series` = "true" → `createRide` delegiert an `createRideWithSeries`.
//   - `recurrence_type`, `days_of_week` (multi), `series_end_date` sind die vom
//     Server erwarteten FormData-Feldnamen (siehe `seriesFieldsSchema`).
//
// Der Kern (`ride-capture-form.tsx`) besitzt den State; dieser Slot rendert nur
// die UI und die versteckten Formularfelder. Für Touch-/60+-Bedienung werden
// große Toggle-Buttons statt Dropdown/Mini-Checkboxen verwendet; die Auswahl
// wird über versteckte Inputs an das Formular übergeben.

import { useMemo } from "react"
import { CalendarRange, Check, Repeat } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { generateDatesForSeries } from "@/lib/ride-series/generate"

export interface SeriesToggleProps {
  /** Whether the ride should be created as a recurring series. */
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  /** Recurrence type: daily | weekly | biweekly | monthly. */
  recurrenceType: string
  onRecurrenceTypeChange: (value: string) => void
  /** Selected weekdays (for weekly/biweekly). */
  daysOfWeek: string[]
  onDaysOfWeekChange: (days: string[]) => void
  /** Optional ISO end date for the series. */
  endDate: string
  onEndDateChange: (value: string) => void
  /** Current ride direction (drives the generated-count preview). */
  direction: string
}

type RecurrenceType = "daily" | "weekly" | "biweekly" | "monthly"
type DayValue =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday"

const RECURRENCE_OPTIONS: ReadonlyArray<{ value: RecurrenceType; label: string }> = [
  { value: "daily", label: "Täglich" },
  { value: "weekly", label: "Wöchentlich" },
  { value: "biweekly", label: "Alle 2 Wochen" },
  { value: "monthly", label: "Monatlich" },
]

const WEEKDAYS: ReadonlyArray<{ value: DayValue; label: string }> = [
  { value: "monday", label: "Mo" },
  { value: "tuesday", label: "Di" },
  { value: "wednesday", label: "Mi" },
  { value: "thursday", label: "Do" },
  { value: "friday", label: "Fr" },
  { value: "saturday", label: "Sa" },
  { value: "sunday", label: "So" },
]

/** Default preview window (days) when no explicit end date is set. */
const PREVIEW_WINDOW_DAYS = 30

export function SeriesToggle({
  enabled,
  onEnabledChange,
  recurrenceType,
  onRecurrenceTypeChange,
  daysOfWeek,
  onDaysOfWeekChange,
  endDate,
  onEndDateChange,
  direction,
}: SeriesToggleProps) {
  const showWeekdays =
    recurrenceType === "weekly" || recurrenceType === "biweekly"

  const toggleDay = (day: DayValue): void => {
    onDaysOfWeekChange(
      daysOfWeek.includes(day)
        ? daysOfWeek.filter((d) => d !== day)
        : [...daysOfWeek, day]
    )
  }

  // --- Preview: how many rides the series would generate (informative). ---
  const previewCount = useMemo<number | null>(() => {
    if (!enabled || !recurrenceType) return null
    const today = new Date().toISOString().split("T")[0]!
    const windowEnd = new Date(
      Date.now() + PREVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000
    )
      .toISOString()
      .split("T")[0]!
    try {
      const dates = generateDatesForSeries(
        {
          recurrence_type: recurrenceType as RecurrenceType,
          days_of_week:
            daysOfWeek.length > 0 ? (daysOfWeek as DayValue[]) : null,
          start_date: today,
          end_date: endDate || null,
        },
        today,
        endDate || windowEnd
      )
      // A round trip ("both") produces an outbound + return per date.
      return direction === "both" ? dates.length * 2 : dates.length
    } catch {
      return null
    }
  }, [enabled, recurrenceType, daysOfWeek, endDate, direction])

  return (
    <div className="space-y-3">
      {/* Hidden field consumed by createRide to branch into series creation. */}
      <input type="hidden" name="enable_series" value={enabled ? "true" : ""} />

      {/* --- Master toggle (large, touch-/60+-friendly) --- */}
      <button
        type="button"
        onClick={() => onEnabledChange(!enabled)}
        aria-pressed={enabled}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-ring/40 focus:ring-offset-1",
          enabled
            ? "border-primary bg-primary/5"
            : "border-input bg-white hover:bg-muted/50"
        )}
      >
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
            enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          )}
          aria-hidden="true"
        >
          <Repeat className="h-4 w-4" />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-medium text-foreground">
            Fahrt wiederholen
          </span>
          <span className="block text-xs text-muted-foreground">
            Als regelmäßige Fahrtserie anlegen
          </span>
        </span>
        {/* Switch-like visual indicator. */}
        <span
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
            enabled ? "bg-primary" : "bg-input"
          )}
          aria-hidden="true"
        >
          <span
            className={cn(
              "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
              enabled ? "translate-x-5" : "translate-x-0.5"
            )}
          />
        </span>
      </button>

      {enabled && (
        <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
          {/* Recurrence type */}
          <div className="space-y-2">
            <Label>Wiederholung</Label>
            {/* Hidden field carrying the selected recurrence for the server. */}
            <input type="hidden" name="recurrence_type" value={recurrenceType} />
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {RECURRENCE_OPTIONS.map((option) => {
                const active = recurrenceType === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onRecurrenceTypeChange(option.value)}
                    aria-pressed={active}
                    className={cn(
                      "min-h-[2.5rem] rounded-lg border px-2.5 py-2 text-sm font-medium transition-colors",
                      "focus:outline-none focus:ring-2 focus:ring-ring/40 focus:ring-offset-1",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-input bg-white text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Weekdays (weekly / biweekly only) */}
          {showWeekdays && (
            <div className="space-y-2">
              <Label>Wochentage</Label>
              {/* Hidden multi-value field consumed via formData.getAll. */}
              {daysOfWeek.map((day) => (
                <input
                  key={day}
                  type="hidden"
                  name="days_of_week"
                  value={day}
                />
              ))}
              <div
                className="flex flex-wrap gap-1.5"
                role="group"
                aria-label="Wochentage der Serie"
              >
                {WEEKDAYS.map((day) => {
                  const active = daysOfWeek.includes(day.value)
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDay(day.value)}
                      aria-pressed={active}
                      className={cn(
                        "inline-flex min-h-[2.5rem] min-w-[2.75rem] items-center justify-center gap-1 rounded-lg border px-2.5 py-2 text-sm font-medium transition-colors",
                        "focus:outline-none focus:ring-2 focus:ring-ring/40 focus:ring-offset-1",
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-input bg-white text-muted-foreground hover:bg-muted/50"
                      )}
                    >
                      {active && (
                        <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      )}
                      {day.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* End date */}
          <div className="space-y-2">
            <Label htmlFor="series_end_date">Enddatum (optional)</Label>
            <Input
              id="series_end_date"
              name="series_end_date"
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
            />
          </div>

          {/* Preview */}
          {previewCount !== null && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarRange className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Generiert ca.{" "}
              <span className="font-medium text-foreground">
                {previewCount}
              </span>{" "}
              {previewCount === 1 ? "Fahrt" : "Fahrten"}
              {!endDate ? " (nächste 30 Tage)" : ""}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
