"use client"

import { useFormState } from "react-dom"
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
import { SubmitButton } from "@/components/shared/submit-button"
import { AddressFields } from "@/components/shared/address-fields"
import { createDriver, updateDriver } from "@/actions/drivers"
import type { Tables } from "@/lib/types/database"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface DriverFormProps {
  driver?: Tables<"drivers">
}

export function DriverForm({ driver }: DriverFormProps) {
  const action = driver
    ? updateDriver.bind(null, driver.id)
    : createDriver

  const [state, formAction] = useFormState(action, null)

  const fieldErrors = state && !state.success ? state.fieldErrors : undefined

  return (
    <form action={formAction}>
      <Card>
        <CardHeader>
          <CardTitle>
            {driver ? "Fahrer bearbeiten" : "Neuer Fahrer"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {state && !state.success && state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          {/* --- Name --- */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="first_name">Vorname <span className="text-destructive">*</span></Label>
              <Input
                id="first_name"
                name="first_name"
                required
                defaultValue={driver?.first_name ?? ""}
              />
              {fieldErrors?.first_name && (
                <p className="text-sm text-destructive">{fieldErrors.first_name[0]}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Nachname <span className="text-destructive">*</span></Label>
              <Input
                id="last_name"
                name="last_name"
                required
                defaultValue={driver?.last_name ?? ""}
              />
              {fieldErrors?.last_name && (
                <p className="text-sm text-destructive">{fieldErrors.last_name[0]}</p>
              )}
            </div>
          </div>

          {/* --- Telefon / Fahrzeugtyp --- */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={driver?.phone ?? ""}
              />
              {fieldErrors?.phone && (
                <p className="text-sm text-destructive">{fieldErrors.phone[0]}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicle_type">Fahrzeugtyp <span className="text-destructive">*</span></Label>
              <Select
                name="vehicle_type"
                defaultValue={driver?.vehicle_type ?? "standard"}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="wheelchair">Rollstuhl</SelectItem>
                  <SelectItem value="stretcher">Trage</SelectItem>
                </SelectContent>
              </Select>
              {fieldErrors?.vehicle_type && (
                <p className="text-sm text-destructive">{fieldErrors.vehicle_type[0]}</p>
              )}
            </div>
          </div>

          {/* --- Adresse (wiederverwendbare Komponente) --- */}
          <AddressFields
            defaultValues={{
              street: driver?.street,
              house_number: driver?.house_number,
              postal_code: driver?.postal_code,
              city: driver?.city,
            }}
            errors={fieldErrors}
            required
          />

          {/* --- Fahrzeug / Fahrausweis --- */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="vehicle">Fahrzeug</Label>
              <Input
                id="vehicle"
                name="vehicle"
                placeholder="z.B. VW Caddy Maxi, ZH 123456"
                defaultValue={driver?.vehicle ?? ""}
              />
              {fieldErrors?.vehicle && (
                <p className="text-sm text-destructive">{fieldErrors.vehicle[0]}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="driving_license">Fahrausweis</Label>
              <Input
                id="driving_license"
                name="driving_license"
                placeholder="z.B. Kat. B, Nr. 1234567"
                defaultValue={driver?.driving_license ?? ""}
              />
              {fieldErrors?.driving_license && (
                <p className="text-sm text-destructive">{fieldErrors.driving_license[0]}</p>
              )}
            </div>
          </div>

          {/* --- Notfallkontakt --- */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-medium">Notfallkontakt</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="emergency_contact_name">Name</Label>
                <Input
                  id="emergency_contact_name"
                  name="emergency_contact_name"
                  defaultValue={driver?.emergency_contact_name ?? ""}
                />
                {fieldErrors?.emergency_contact_name && (
                  <p className="text-sm text-destructive">
                    {fieldErrors.emergency_contact_name[0]}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergency_contact_phone">Telefon</Label>
                <Input
                  id="emergency_contact_phone"
                  name="emergency_contact_phone"
                  type="tel"
                  defaultValue={driver?.emergency_contact_phone ?? ""}
                />
                {fieldErrors?.emergency_contact_phone && (
                  <p className="text-sm text-destructive">
                    {fieldErrors.emergency_contact_phone[0]}
                  </p>
                )}
              </div>
            </div>
          </fieldset>

          {/* --- Notizen --- */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notizen</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={driver?.notes ?? ""}
            />
            {fieldErrors?.notes && (
              <p className="text-sm text-destructive">{fieldErrors.notes[0]}</p>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <SubmitButton>Speichern</SubmitButton>
            <Button variant="outline" asChild>
              <Link href="/drivers">Abbrechen</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
