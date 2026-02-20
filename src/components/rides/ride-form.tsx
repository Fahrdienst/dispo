"use client"

import { useState, useTransition, useEffect, useCallback } from "react"
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
import {
  createRide,
  updateRide,
  calculateRouteForRide,
} from "@/actions/rides"
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

interface RouteInfo {
  distance_meters: number
  duration_seconds: number
}

function formatDistance(meters: number): string {
  return (meters / 1000).toFixed(1) + " km"
}

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} Min.`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes > 0
    ? `${hours} Std. ${remainingMinutes} Min.`
    : `${hours} Std.`
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

  // --- Route calculation state ---
  const [selectedPatientId, setSelectedPatientId] = useState<string>(
    ride?.patient_id ?? ""
  )
  const [selectedDestinationId, setSelectedDestinationId] = useState<string>(
    ride?.destination_id ?? ""
  )
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(
    ride?.distance_meters != null && ride?.duration_seconds != null
      ? {
          distance_meters: ride.distance_meters,
          duration_seconds: ride.duration_seconds,
        }
      : null
  )
  const [routeError, setRouteError] = useState<string | null>(null)
  const [isCalculatingRoute, startRouteTransition] = useTransition()

  // --- Price override state ---
  const [showPriceOverride, setShowPriceOverride] = useState(
    ride?.price_override != null
  )

  const isOutbound = direction === "outbound"
  const showReturnPickupTime = isOutbound && appointmentEndTime !== ""
  const showAutoReturnCheckbox =
    !isEdit && isOutbound && appointmentEndTime !== ""

  const calculateRoute = useCallback(
    (patientId: string, destinationId: string) => {
      if (!patientId || !destinationId) return

      startRouteTransition(async () => {
        setRouteError(null)
        const result = await calculateRouteForRide(patientId, destinationId)
        if (result.success) {
          setRouteInfo(result.data)
        } else {
          setRouteError(result.error ?? "Routenberechnung fehlgeschlagen")
          setRouteInfo(null)
        }
      })
    },
    []
  )

  // Auto-calculate route when patient or destination changes
  useEffect(() => {
    if (selectedPatientId && selectedDestinationId) {
      calculateRoute(selectedPatientId, selectedDestinationId)
    }
  }, [selectedPatientId, selectedDestinationId, calculateRoute])

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
                onValueChange={setSelectedPatientId}
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
                onValueChange={setSelectedDestinationId}
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

          {/* --- Route info display (Issue #58) --- */}
          {(isCalculatingRoute || routeInfo || routeError) && (
            <div className="rounded-md border px-4 py-3">
              {isCalculatingRoute && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                  Route wird berechnet...
                </div>
              )}
              {!isCalculatingRoute && routeInfo && (
                <div className="flex items-center gap-4 text-sm">
                  <span className="font-medium">Route:</span>
                  <span>~{formatDistance(routeInfo.distance_meters)}</span>
                  <span className="text-muted-foreground">|</span>
                  <span>~{formatDuration(routeInfo.duration_seconds)} Fahrzeit</span>
                </div>
              )}
              {!isCalculatingRoute && routeError && (
                <p className="text-sm text-amber-700">
                  Routenberechnung nicht moeglich: {routeError}
                </p>
              )}
            </div>
          )}

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
          <fieldset className="space-y-4 rounded-lg border bg-muted/30 p-4">
            <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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

          {/* --- Price Override (ADR-010, Issue #60) --- */}
          <fieldset className="space-y-4 rounded-lg border bg-muted/30 p-4">
            <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Preis
            </legend>

            {/* Show calculated price if available (edit mode) */}
            {isEdit && ride?.calculated_price != null && (
              <div className="text-sm">
                <span className="text-muted-foreground">
                  Berechneter Preis:{" "}
                </span>
                <span className="font-medium">
                  CHF {Number(ride.calculated_price).toFixed(2)}
                </span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Checkbox
                id="toggle_price_override"
                checked={showPriceOverride}
                onCheckedChange={(checked) =>
                  setShowPriceOverride(checked === true)
                }
              />
              <Label
                htmlFor="toggle_price_override"
                className="text-sm font-normal"
              >
                Preis manuell ueberschreiben
              </Label>
            </div>

            {showPriceOverride && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="price_override">
                    Preis (CHF) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="price_override"
                    name="price_override"
                    type="number"
                    step="0.05"
                    min="0"
                    defaultValue={
                      ride?.price_override != null
                        ? String(ride.price_override)
                        : ""
                    }
                  />
                  {fieldErrors?.price_override && (
                    <p className="text-sm text-destructive">
                      {fieldErrors.price_override[0]}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price_override_reason">
                    Begruendung <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="price_override_reason"
                    name="price_override_reason"
                    rows={2}
                    defaultValue={ride?.price_override_reason ?? ""}
                    placeholder="Warum wird der berechnete Preis ueberschrieben?"
                  />
                  {fieldErrors?.price_override_reason && (
                    <p className="text-sm text-destructive">
                      {fieldErrors.price_override_reason[0]}
                    </p>
                  )}
                </div>
              </div>
            )}
          </fieldset>

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
