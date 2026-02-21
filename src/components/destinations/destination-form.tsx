"use client"

import { useState, useRef } from "react"
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
import { AddressFields } from "@/components/shared/address-fields"
import { LocationMap } from "@/components/shared/location-map"
import {
  PlacesAutocomplete,
  type PlaceSelectResult,
} from "@/components/shared/places-autocomplete"
import { createDestination, updateDestination } from "@/actions/destinations"
import type { Tables } from "@/lib/types/database"

interface DestinationFormProps {
  destination?: Tables<"destinations">
}

/**
 * Parse a Swiss formatted address from Google Places into address components.
 * Expected format: "Strasse Nr, PLZ Ort, Land" or "Strasse Nr, Ort, Land"
 */
function parseSwissAddress(formattedAddress: string): {
  street: string
  house_number: string
  postal_code: string
  city: string
} {
  const result = { street: "", house_number: "", postal_code: "", city: "" }

  // Split by comma and trim
  const parts = formattedAddress.split(",").map((p) => p.trim())
  if (parts.length === 0) return result

  // First part: "Strasse Nr" or "Strasse"
  const streetPart = parts[0] ?? ""
  const streetMatch = streetPart.match(/^(.+?)\s+(\d+\w*)$/)
  if (streetMatch) {
    result.street = streetMatch[1] ?? ""
    result.house_number = streetMatch[2] ?? ""
  } else {
    result.street = streetPart
  }

  // Second part: "PLZ Ort" or just "Ort"
  const cityPart = parts[1] ?? ""
  const plzCityMatch = cityPart.match(/^(\d{4})\s+(.+)$/)
  if (plzCityMatch) {
    result.postal_code = plzCityMatch[1] ?? ""
    result.city = plzCityMatch[2] ?? ""
  } else {
    result.city = cityPart
  }

  return result
}

export function DestinationForm({ destination }: DestinationFormProps) {
  const action = destination
    ? updateDestination.bind(null, destination.id)
    : createDestination

  const [state, formAction] = useFormState(action, null)

  const fieldErrors = state && !state.success ? state.fieldErrors : undefined

  // Refs for hidden geo fields
  const placeIdRef = useRef<HTMLInputElement>(null)
  const latRef = useRef<HTMLInputElement>(null)
  const lngRef = useRef<HTMLInputElement>(null)
  const formattedAddressRef = useRef<HTMLInputElement>(null)

  // State for address fields that can be overridden by Places selection
  const [addressOverrides, setAddressOverrides] = useState<{
    display_name?: string
    street?: string
    house_number?: string
    postal_code?: string
    city?: string
    contact_phone?: string
  }>({})

  const [placeSelected, setPlaceSelected] = useState(false)

  function handlePlaceSelect(place: PlaceSelectResult): void {
    // Parse address components from formatted_address
    const parsed = parseSwissAddress(place.formatted_address)

    // Set hidden geo fields
    if (placeIdRef.current) placeIdRef.current.value = place.place_id
    if (latRef.current) latRef.current.value = String(place.lat)
    if (lngRef.current) lngRef.current.value = String(place.lng)
    if (formattedAddressRef.current)
      formattedAddressRef.current.value = place.formatted_address

    // Pre-fill visible fields
    setAddressOverrides({
      display_name: place.name,
      street: parsed.street,
      house_number: parsed.house_number,
      postal_code: parsed.postal_code,
      city: parsed.city,
      contact_phone: place.phone,
    })

    setPlaceSelected(true)
  }

  // Use overrides or existing destination data
  const displayName =
    addressOverrides.display_name ?? destination?.display_name ?? ""
  const street = addressOverrides.street ?? destination?.street ?? ""
  const houseNumber =
    addressOverrides.house_number ?? destination?.house_number ?? ""
  const postalCode =
    addressOverrides.postal_code ?? destination?.postal_code ?? ""
  const city = addressOverrides.city ?? destination?.city ?? ""
  const contactPhone =
    addressOverrides.contact_phone ?? destination?.contact_phone ?? ""

  return (
    <form action={formAction}>
      {/* Hidden geo fields */}
      <input
        type="hidden"
        name="place_id"
        ref={placeIdRef}
        defaultValue={destination?.place_id ?? ""}
      />
      <input
        type="hidden"
        name="lat"
        ref={latRef}
        defaultValue={destination?.lat != null ? String(destination.lat) : ""}
      />
      <input
        type="hidden"
        name="lng"
        ref={lngRef}
        defaultValue={destination?.lng != null ? String(destination.lng) : ""}
      />
      <input
        type="hidden"
        name="formatted_address"
        ref={formattedAddressRef}
        defaultValue={destination?.formatted_address ?? ""}
      />

      <Card>
        <CardHeader>
          <CardTitle>
            {destination ? "Ziel bearbeiten" : "Neues Ziel"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {state && !state.success && state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          {/* Places Autocomplete search */}
          <div className="space-y-2">
            <Label>Suche (Google Places)</Label>
            <PlacesAutocomplete
              onPlaceSelect={handlePlaceSelect}
              defaultValue=""
              placeholder="Spital, Praxis oder Adresse suchen..."
            />
            <p className="text-xs text-muted-foreground">
              Waehlen Sie einen Vorschlag, um die Felder automatisch
              auszufuellen. Alle Felder koennen danach manuell angepasst werden.
            </p>
          </div>

          {placeSelected && (
            <div className="rounded-md border border-green-300 bg-green-50 px-4 py-2 text-sm text-green-800">
              Adressdaten aus Google Places uebernommen. Bitte pruefen und
              gegebenenfalls anpassen.
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="display_name">
                Einrichtungsname <span className="text-destructive">*</span>
              </Label>
              <Input
                id="display_name"
                name="display_name"
                required
                key={`display_name-${displayName}`}
                defaultValue={displayName}
              />
              {fieldErrors?.display_name && (
                <p className="text-sm text-destructive">
                  {fieldErrors.display_name[0]}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="facility_type">
                Einrichtungstyp <span className="text-destructive">*</span>
              </Label>
              <Select
                name="facility_type"
                defaultValue={destination?.facility_type ?? "other"}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="practice">Praxis</SelectItem>
                  <SelectItem value="hospital">Spital</SelectItem>
                  <SelectItem value="therapy_center">Therapiezentrum</SelectItem>
                  <SelectItem value="day_care">Tagesheim</SelectItem>
                  <SelectItem value="other">Sonstiges</SelectItem>
                </SelectContent>
              </Select>
              {fieldErrors?.facility_type && (
                <p className="text-sm text-destructive">
                  {fieldErrors.facility_type[0]}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="department">Abteilung / Station</Label>
            <Input
              id="department"
              name="department"
              defaultValue={destination?.department ?? ""}
            />
            {fieldErrors?.department && (
              <p className="text-sm text-destructive">
                {fieldErrors.department[0]}
              </p>
            )}
          </div>

          {/* Address fields with Places-overridden values */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-medium">Adresse</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div className="sm:col-span-3 space-y-2">
                <Label htmlFor="street">
                  Strasse <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="street"
                  name="street"
                  required
                  key={`street-${street}`}
                  defaultValue={street}
                />
                {fieldErrors?.street && (
                  <p className="text-sm text-destructive">
                    {fieldErrors.street[0]}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="house_number">
                  Hausnr. <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="house_number"
                  name="house_number"
                  required
                  key={`house_number-${houseNumber}`}
                  defaultValue={houseNumber}
                />
                {fieldErrors?.house_number && (
                  <p className="text-sm text-destructive">
                    {fieldErrors.house_number[0]}
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="postal_code">
                  PLZ <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="postal_code"
                  name="postal_code"
                  required
                  key={`postal_code-${postalCode}`}
                  defaultValue={postalCode}
                />
                {fieldErrors?.postal_code && (
                  <p className="text-sm text-destructive">
                    {fieldErrors.postal_code[0]}
                  </p>
                )}
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="city">
                  Ort <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="city"
                  name="city"
                  required
                  key={`city-${city}`}
                  defaultValue={city}
                />
                {fieldErrors?.city && (
                  <p className="text-sm text-destructive">
                    {fieldErrors.city[0]}
                  </p>
                )}
              </div>
            </div>
          </fieldset>

          {destination && (
            <LocationMap
              lat={destination.lat}
              lng={destination.lng}
              label={destination.display_name}
              geocodeStatus={destination.geocode_status}
            />
          )}

          <fieldset className="space-y-4">
            <legend className="text-sm font-medium">Kontaktperson</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contact_first_name">
                  Vorname <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="contact_first_name"
                  name="contact_first_name"
                  required
                  defaultValue={destination?.contact_first_name ?? ""}
                />
                {fieldErrors?.contact_first_name && (
                  <p className="text-sm text-destructive">
                    {fieldErrors.contact_first_name[0]}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_last_name">
                  Nachname <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="contact_last_name"
                  name="contact_last_name"
                  required
                  defaultValue={destination?.contact_last_name ?? ""}
                />
                {fieldErrors?.contact_last_name && (
                  <p className="text-sm text-destructive">
                    {fieldErrors.contact_last_name[0]}
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_phone">
                Telefon <span className="text-destructive">*</span>
              </Label>
              <Input
                id="contact_phone"
                name="contact_phone"
                type="tel"
                required
                key={`contact_phone-${contactPhone}`}
                defaultValue={contactPhone}
              />
              {fieldErrors?.contact_phone && (
                <p className="text-sm text-destructive">
                  {fieldErrors.contact_phone[0]}
                </p>
              )}
            </div>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="comment">Kommentar</Label>
            <Textarea
              id="comment"
              name="comment"
              rows={3}
              defaultValue={destination?.comment ?? ""}
            />
            {fieldErrors?.comment && (
              <p className="text-sm text-destructive">
                {fieldErrors.comment[0]}
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <SubmitButton>Speichern</SubmitButton>
            <Button variant="outline" asChild>
              <Link href="/destinations">Abbrechen</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
