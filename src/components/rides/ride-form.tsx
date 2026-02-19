"use client"

import { useFormState } from "react-dom"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import type { Tables } from "@/lib/types/database"

interface RideFormProps {
  ride?: Tables<"rides">
  defaultDate?: string
  patients: Pick<Tables<"patients">, "id" | "first_name" | "last_name">[]
  destinations: Pick<Tables<"destinations">, "id" | "name">[]
  drivers: Pick<Tables<"drivers">, "id" | "first_name" | "last_name">[]
}

export function RideForm({ ride, defaultDate, patients, destinations, drivers }: RideFormProps) {
  const action = ride ? updateRide.bind(null, ride.id) : createRide
  const [state, formAction] = useFormState(action, null)
  const fieldErrors = state && !state.success ? state.fieldErrors : undefined

  return (
    <form action={formAction}>
      <Card>
        <CardHeader>
          <CardTitle>
            {ride ? "Fahrt bearbeiten" : "Neue Fahrt"}
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
                defaultValue={ride?.patient_id ?? ""}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Patient wählen..." />
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
                  <SelectValue placeholder="Ziel wählen..." />
                </SelectTrigger>
                <SelectContent>
                  {destinations.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
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
                defaultValue={ride?.pickup_time ?? ""}
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
