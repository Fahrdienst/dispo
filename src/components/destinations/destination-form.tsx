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
import { AddressFields } from "@/components/shared/address-fields"
import { createDestination, updateDestination } from "@/actions/destinations"
import type { Tables } from "@/lib/types/database"

interface DestinationFormProps {
  destination?: Tables<"destinations">
}

export function DestinationForm({ destination }: DestinationFormProps) {
  const action = destination
    ? updateDestination.bind(null, destination.id)
    : createDestination

  const [state, formAction] = useFormState(action, null)

  const fieldErrors = state && !state.success ? state.fieldErrors : undefined

  return (
    <form action={formAction}>
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="display_name">
                Einrichtungsname <span className="text-destructive">*</span>
              </Label>
              <Input
                id="display_name"
                name="display_name"
                required
                defaultValue={destination?.display_name ?? ""}
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

          <AddressFields
            defaultValues={destination}
            errors={fieldErrors}
            required
          />

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
                defaultValue={destination?.contact_phone ?? ""}
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
