"use client"

import { useState } from "react"
import { useFormState } from "react-dom"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SubmitButton } from "@/components/shared/submit-button"
import { AddressFields } from "@/components/shared/address-fields"
import { LocationMap } from "@/components/shared/location-map"
import { PlacesAutocomplete, type PlaceSelectResult } from "@/components/shared/places-autocomplete"
import { createPatient, updatePatient } from "@/actions/patients"
import type { Tables } from "@/lib/types/database"

const IMPAIRMENT_OPTIONS = [
  { value: "rollator", label: "Rollator" },
  { value: "wheelchair", label: "Rollstuhl" },
  { value: "stretcher", label: "Liegendtransport" },
  { value: "companion", label: "Begleitperson" },
] as const

interface PatientFormProps {
  patient?: Tables<"patients"> & {
    patient_impairments?: Tables<"patient_impairments">[]
  }
}

export function PatientForm({ patient }: PatientFormProps) {
  const action = patient
    ? updatePatient.bind(null, patient.id)
    : createPatient

  const [state, formAction] = useFormState(action, null)

  const [addressValues, setAddressValues] = useState({
    street: patient?.street ?? "",
    house_number: patient?.house_number ?? "",
    postal_code: patient?.postal_code ?? "",
    city: patient?.city ?? "",
    place_id: patient?.place_id ?? "",
    lat: patient?.lat?.toString() ?? "",
    lng: patient?.lng?.toString() ?? "",
  })

  const initialImpairments = (patient?.patient_impairments ?? []).map(
    (pi) => pi.impairment_type
  )
  const [checkedImpairments, setCheckedImpairments] =
    useState<string[]>(initialImpairments)

  const fieldErrors = state && !state.success ? state.fieldErrors : undefined

  function toggleImpairment(value: string, checked: boolean) {
    setCheckedImpairments((prev) =>
      checked ? [...prev, value] : prev.filter((v) => v !== value)
    )
  }

  const handlePlaceSelect = (place: PlaceSelectResult) => {
    // Basic regex-based extraction for simple Swiss addresses (Street Number)
    const streetMatch = place.formatted_address.match(/^([^,0-9]+)\s*([0-9a-zA-Z]*)/)
    const street = streetMatch?.[1]?.trim() ?? ""
    const houseNumber = streetMatch?.[2]?.trim() ?? ""

    setAddressValues({
      street,
      house_number: houseNumber,
      postal_code: place.formatted_address.match(/\b(\d{4})\b/)?.[1] ?? "",
      city: place.formatted_address.split(",").slice(-2, -1)[0]?.replace(/\d{4}/, "").trim() ?? "",
      place_id: place.place_id,
      lat: place.lat.toString(),
      lng: place.lng.toString(),
    })
  }

  return (
    <form action={formAction}>
      <Card>
        <CardHeader>
          <CardTitle>
            {patient ? "Patient bearbeiten" : "Neuer Patient"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {state && !state.success && state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="first_name">Vorname</Label>
              <Input
                id="first_name"
                name="first_name"
                required
                defaultValue={patient?.first_name ?? ""}
              />
              {fieldErrors?.first_name && (
                <p className="text-sm text-destructive">
                  {fieldErrors.first_name[0]}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Nachname</Label>
              <Input
                id="last_name"
                name="last_name"
                required
                defaultValue={patient?.last_name ?? ""}
              />
              {fieldErrors?.last_name && (
                <p className="text-sm text-destructive">
                  {fieldErrors.last_name[0]}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefon</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={patient?.phone ?? ""}
            />
            {fieldErrors?.phone && (
              <p className="text-sm text-destructive">
                {fieldErrors.phone[0]}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Adresssuche (Google Maps)</Label>
            <PlacesAutocomplete onPlaceSelect={handlePlaceSelect} />
          </div>

          <AddressFields
            values={addressValues}
            onChange={(field, value) => setAddressValues(prev => ({ ...prev, [field]: value }))}
            errors={fieldErrors}
            required
          />

          {/* Hidden fields for Geodata */}
          <input type="hidden" name="place_id" value={addressValues.place_id} />
          <input type="hidden" name="lat" value={addressValues.lat} />
          <input type="hidden" name="lng" value={addressValues.lng} />

          {patient && (
            <LocationMap
              lat={patient.lat}
              lng={patient.lng}
              label={`${patient.first_name} ${patient.last_name}`}
              geocodeStatus={patient.geocode_status}
            />
          )}

          <div className="rounded-lg border bg-muted/30 p-4">
            <fieldset className="space-y-4">
              <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Notfallkontakt
              </legend>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="emergency_contact_name">Name Notfallkontakt</Label>
                  <Input
                    id="emergency_contact_name"
                    name="emergency_contact_name"
                    defaultValue={patient?.emergency_contact_name ?? ""}
                  />
                  {fieldErrors?.emergency_contact_name && (
                    <p className="text-sm text-destructive">
                      {fieldErrors.emergency_contact_name[0]}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergency_contact_phone">Telefon Notfallkontakt</Label>
                  <Input
                    id="emergency_contact_phone"
                    name="emergency_contact_phone"
                    type="tel"
                    defaultValue={patient?.emergency_contact_phone ?? ""}
                  />
                  {fieldErrors?.emergency_contact_phone && (
                    <p className="text-sm text-destructive">
                      {fieldErrors.emergency_contact_phone[0]}
                    </p>
                  )}
                </div>
              </div>
            </fieldset>
          </div>

          <div className="rounded-lg border bg-muted/30 p-4">
            <fieldset className="space-y-3">
              <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Beeinträchtigungen
              </legend>
              {IMPAIRMENT_OPTIONS.map((option) => (
                <div key={option.value} className="flex items-center gap-2">
                  <Checkbox
                    id={`impairment_${option.value}`}
                    checked={checkedImpairments.includes(option.value)}
                    onCheckedChange={(checked) =>
                      toggleImpairment(option.value, checked === true)
                    }
                  />
                  <Label
                    htmlFor={`impairment_${option.value}`}
                    className="text-sm font-normal"
                  >
                    {option.label}
                  </Label>
                </div>
              ))}
              {checkedImpairments.map((value) => (
                <input
                  key={value}
                  type="hidden"
                  name="impairments"
                  value={value}
                />
              ))}
              {fieldErrors?.impairments && (
                <p className="text-sm text-destructive">
                  {fieldErrors.impairments[0]}
                </p>
              )}
            </fieldset>
          </div>

          <div className="space-y-2">
            <Label htmlFor="comment">Kommentar</Label>
            <Textarea
              id="comment"
              name="comment"
              rows={3}
              defaultValue={patient?.comment ?? ""}
            />
            {fieldErrors?.comment && (
              <p className="text-sm text-destructive">
                {fieldErrors.comment[0]}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Interne Notizen</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={patient?.notes ?? ""}
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
              <Link href="/patients">Abbrechen</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
