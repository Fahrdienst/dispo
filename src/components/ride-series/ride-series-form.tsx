"use client"

import { useState } from "react"
import { useFormState } from "react-dom"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SubmitButton } from "@/components/shared/submit-button"
import { createRideSeries, updateRideSeries } from "@/actions/ride-series"
import { RIDE_DIRECTION_LABELS } from "@/lib/rides/constants"
import {
  RECURRENCE_TYPE_LABELS,
  DAY_OF_WEEK_LABELS,
  ALL_DAYS_OF_WEEK,
} from "@/lib/ride-series/constants"
import type { Tables, Enums } from "@/lib/types/database"

interface RideSeriesFormProps {
  series?: Tables<"ride_series">
  patients: Pick<Tables<"patients">, "id" | "first_name" | "last_name">[]
  destinations: Pick<Tables<"destinations">, "id" | "display_name">[]
}

export function RideSeriesForm({
  series,
  patients,
  destinations,
}: RideSeriesFormProps) {
  const action = series
    ? updateRideSeries.bind(null, series.id)
    : createRideSeries
  const [state, formAction] = useFormState(action, null)
  const fieldErrors = state && !state.success ? state.fieldErrors : undefined

  const initialDays: string[] = series?.days_of_week ?? []
  const [checkedDays, setCheckedDays] = useState<string[]>(initialDays)

  const initialRecurrence = series?.recurrence_type ?? "weekly"
  const [recurrenceType, setRecurrenceType] =
    useState<string>(initialRecurrence)

  const showDaysOfWeek =
    recurrenceType === "weekly" || recurrenceType === "biweekly"

  function toggleDay(value: string, checked: boolean) {
    setCheckedDays((prev) =>
      checked ? [...prev, value] : prev.filter((v) => v !== value)
    )
  }

  return (
    <form action={formAction}>
      <Card>
        <CardHeader>
          <CardTitle>
            {series ? "Fahrtserie bearbeiten" : "Neue Fahrtserie"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {state && !state.success && state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="patient_id">Patient</Label>
              <Select
                name="patient_id"
                defaultValue={series?.patient_id ?? ""}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Patient waehlen..." />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.last_name}, {p.first_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors?.patient_id && (
                <p className="text-sm text-destructive">
                  {fieldErrors.patient_id[0]}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="destination_id">Ziel</Label>
              <Select
                name="destination_id"
                defaultValue={series?.destination_id ?? ""}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Ziel waehlen..." />
                </SelectTrigger>
                <SelectContent>
                  {destinations.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors?.destination_id && (
                <p className="text-sm text-destructive">
                  {fieldErrors.destination_id[0]}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="pickup_time">Abholzeit</Label>
              <Input
                id="pickup_time"
                name="pickup_time"
                type="time"
                required
                defaultValue={series?.pickup_time?.slice(0, 5) ?? ""}
              />
              {fieldErrors?.pickup_time && (
                <p className="text-sm text-destructive">
                  {fieldErrors.pickup_time[0]}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="direction">Richtung</Label>
              <Select
                name="direction"
                defaultValue={series?.direction ?? "outbound"}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    Object.entries(RIDE_DIRECTION_LABELS) as [string, string][]
                  ).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors?.direction && (
                <p className="text-sm text-destructive">
                  {fieldErrors.direction[0]}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="recurrence_type">Wiederholungstyp</Label>
              <Select
                name="recurrence_type"
                defaultValue={initialRecurrence}
                onValueChange={setRecurrenceType}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    Object.entries(RECURRENCE_TYPE_LABELS) as [string, string][]
                  ).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors?.recurrence_type && (
                <p className="text-sm text-destructive">
                  {fieldErrors.recurrence_type[0]}
                </p>
              )}
            </div>
          </div>

          {showDaysOfWeek && (
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Wochentage</legend>
              <div className="flex flex-wrap gap-4">
                {ALL_DAYS_OF_WEEK.map((day) => (
                  <div key={day} className="flex items-center gap-2">
                    <Checkbox
                      id={`day_${day}`}
                      checked={checkedDays.includes(day)}
                      onCheckedChange={(checked) =>
                        toggleDay(day, checked === true)
                      }
                    />
                    <Label
                      htmlFor={`day_${day}`}
                      className="text-sm font-normal"
                    >
                      {DAY_OF_WEEK_LABELS[day]}
                    </Label>
                  </div>
                ))}
              </div>
              {checkedDays.map((day) => (
                <input
                  key={day}
                  type="hidden"
                  name="days_of_week"
                  value={day}
                />
              ))}
              {fieldErrors?.days_of_week && (
                <p className="text-sm text-destructive">
                  {fieldErrors.days_of_week[0]}
                </p>
              )}
            </fieldset>
          )}

          {/* --- Appointment Times --- */}
          <fieldset className="space-y-4 rounded-lg border bg-muted/30 p-4">
            <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Termin (optional)
            </legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="appointment_time">Terminbeginn</Label>
                <Input
                  id="appointment_time"
                  name="appointment_time"
                  type="time"
                  defaultValue={series?.appointment_time?.slice(0, 5) ?? ""}
                />
                {fieldErrors?.appointment_time && (
                  <p className="text-sm text-destructive">
                    {fieldErrors.appointment_time[0]}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="appointment_end_time">Terminende</Label>
                <Input
                  id="appointment_end_time"
                  name="appointment_end_time"
                  type="time"
                  defaultValue={
                    series?.appointment_end_time?.slice(0, 5) ?? ""
                  }
                />
                {fieldErrors?.appointment_end_time && (
                  <p className="text-sm text-destructive">
                    {fieldErrors.appointment_end_time[0]}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="return_pickup_time">
                  Rueckfahrt-Abholzeit
                </Label>
                <Input
                  id="return_pickup_time"
                  name="return_pickup_time"
                  type="time"
                  defaultValue={
                    series?.return_pickup_time?.slice(0, 5) ?? ""
                  }
                />
                {fieldErrors?.return_pickup_time && (
                  <p className="text-sm text-destructive">
                    {fieldErrors.return_pickup_time[0]}
                  </p>
                )}
              </div>
            </div>
          </fieldset>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start_date">Startdatum</Label>
              <Input
                id="start_date"
                name="start_date"
                type="date"
                required
                defaultValue={series?.start_date ?? ""}
              />
              {fieldErrors?.start_date && (
                <p className="text-sm text-destructive">
                  {fieldErrors.start_date[0]}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">Enddatum (optional)</Label>
              <Input
                id="end_date"
                name="end_date"
                type="date"
                defaultValue={series?.end_date ?? ""}
              />
              {fieldErrors?.end_date && (
                <p className="text-sm text-destructive">
                  {fieldErrors.end_date[0]}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notizen</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={series?.notes ?? ""}
            />
            {fieldErrors?.notes && (
              <p className="text-sm text-destructive">
                {fieldErrors.notes[0]}
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <SubmitButton>Speichern</SubmitButton>
            <Button variant="outline" asChild>
              <Link href="/ride-series">Abbrechen</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
