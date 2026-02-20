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
import { createRide, updateRide } from "@/actions/rides"
import { RIDE_DIRECTION_LABELS } from "@/lib/rides/constants"
import {
  addMinutesToTime,
  DEFAULT_RETURN_BUFFER_MINUTES,
} from "@/lib/validations/rides"
import type { Tables } from "@/lib/types/database"

interface RideFormProps {
  ride?: Tables<"rides">
  defaultDate?: string
  patients: Pick<Tables<"patients">, "id" | "first_name" | "last_name">[]
  destinations: Pick<Tables<"destinations">, "id" | "display_name">[]
  drivers: Pick<Tables<"drivers">, "id" | "first_name" | "last_name">[]
  /** Number of child rides linked to this ride (parent_ride_id = this ride) */
  linkedRideCount?: number
  /** Whether this ride has a parent (is itself a return ride) */
  hasParentRide?: boolean
}

export function RideForm({
  ride,
  defaultDate,
  patients,
  destinations,
  drivers,
  linkedRideCount = 0,
  hasParentRide = false,
}: RideFormProps) {
  const isEdit = !!ride
  const action = ride ? updateRide.bind(null, ride.id) : createRide
  const [state, formAction] = useFormState(action, null)
  const fieldErrors = state && !state.success ? state.fieldErrors : undefined

  const [direction, setDirection] = useState<string>(
    ride?.direction ?? "outbound"
  )
  const [appointmentEndTime, setAppointmentEndTime] = useState<string>(
    ride?.appointment_end_time?.slice(0, 5) ?? ""
  )
  const [returnPickupTime, setReturnPickupTime] = useState<string>(
    ride?.return_pickup_time?.slice(0, 5) ?? ""
  )

  const isOutbound = direction === "outbound"
  const showReturnPickupTime = isOutbound && appointmentEndTime !== ""
  const showAutoReturnCheckbox =
    !isEdit && isOutbound && appointmentEndTime !== ""

  function handleAppointmentEndTimeChange(value: string): void {
    setAppointmentEndTime(value)
    // Auto-fill return_pickup_time if empty
    if (value && !returnPickupTime) {
      const suggested = addMinutesToTime(value, DEFAULT_RETURN_BUFFER_MINUTES)
      if (suggested) {
        setReturnPickupTime(suggested)
      }
    }
  }

  const hasLinkedRides = linkedRideCount > 0 || hasParentRide

  return (
    <form action={formAction}>
      <Card>
        <CardHeader>
          <CardTitle>{ride ? "Fahrt bearbeiten" : "Neue Fahrt"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {state && !state.success && state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          {/* Warning banner for linked rides (edit mode) */}
          {isEdit && hasLinkedRides && (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {hasParentRide && (
                <p>
                  Diese Fahrt ist eine Heimfahrt und mit einer Hinfahrt
                  verknuepft. Aenderungen werden nicht automatisch auf die
                  Hinfahrt uebertragen.
                </p>
              )}
              {linkedRideCount > 0 && (
                <p>
                  Es {linkedRideCount === 1 ? "gibt" : "gibt"}{" "}
                  {linkedRideCount} verknuepfte Heimfahrt
                  {linkedRideCount > 1 ? "en" : ""}. Bitte pruefen Sie, ob die
                  Abholzeit noch passt.
                </p>
              )}
            </div>
          )}

          {/* --- Patient & Destination --- */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="patient_id">Patient</Label>
              <Select
                name="patient_id"
                defaultValue={ride?.patient_id ?? ""}
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
                defaultValue={ride?.destination_id ?? ""}
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

          {/* --- Date, Pickup Time, Direction --- */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="date">Datum</Label>
              <Input
                id="date"
                name="date"
                type="date"
                required
                defaultValue={ride?.date ?? defaultDate ?? ""}
              />
              {fieldErrors?.date && (
                <p className="text-sm text-destructive">
                  {fieldErrors.date[0]}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="pickup_time">Abholzeit</Label>
              <Input
                id="pickup_time"
                name="pickup_time"
                type="time"
                required
                defaultValue={ride?.pickup_time?.slice(0, 5) ?? ""}
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
                defaultValue={ride?.direction ?? "outbound"}
                onValueChange={setDirection}
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
          </div>

          {/* --- Appointment Times (ADR-008) --- */}
          <fieldset className="space-y-4 rounded-md border px-4 pb-4 pt-2">
            <legend className="px-1 text-sm font-medium text-muted-foreground">
              Termin
            </legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="appointment_time">Terminbeginn</Label>
                <Input
                  id="appointment_time"
                  name="appointment_time"
                  type="time"
                  defaultValue={ride?.appointment_time?.slice(0, 5) ?? ""}
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
                  value={appointmentEndTime}
                  onChange={(e) =>
                    handleAppointmentEndTimeChange(e.target.value)
                  }
                />
                {fieldErrors?.appointment_end_time && (
                  <p className="text-sm text-destructive">
                    {fieldErrors.appointment_end_time[0]}
                  </p>
                )}
              </div>
            </div>

            {/* Return pickup time: only visible for outbound + appointment_end_time set */}
            {showReturnPickupTime && (
              <div className="space-y-2">
                <Label htmlFor="return_pickup_time">
                  Rueckfahrt-Abholzeit
                </Label>
                <Input
                  id="return_pickup_time"
                  name="return_pickup_time"
                  type="time"
                  value={returnPickupTime}
                  onChange={(e) => setReturnPickupTime(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Vorschlag: Terminende + {DEFAULT_RETURN_BUFFER_MINUTES} Min.
                </p>
                {fieldErrors?.return_pickup_time && (
                  <p className="text-sm text-destructive">
                    {fieldErrors.return_pickup_time[0]}
                  </p>
                )}
              </div>
            )}

            {/* Auto-return checkbox: only in create mode + outbound + appointment_end_time set */}
            {showAutoReturnCheckbox && (
              <div className="flex items-center gap-2">
                <Checkbox id="create_return_ride" name="create_return_ride" />
                <Label
                  htmlFor="create_return_ride"
                  className="text-sm font-normal"
                >
                  Heimfahrt automatisch anlegen
                </Label>
              </div>
            )}
          </fieldset>

          {/* --- Driver --- */}
          <div className="space-y-2">
            <Label htmlFor="driver_id">Fahrer</Label>
            <Select
              name="driver_id"
              defaultValue={ride?.driver_id ?? ""}
            >
              <SelectTrigger>
                <SelectValue placeholder="Kein Fahrer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Kein Fahrer</SelectItem>
                {drivers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.last_name}, {d.first_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors?.driver_id && (
              <p className="text-sm text-destructive">
                {fieldErrors.driver_id[0]}
              </p>
            )}
          </div>

          {/* --- Notes --- */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notizen</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={ride?.notes ?? ""}
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
              <Link href="/rides">Abbrechen</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
