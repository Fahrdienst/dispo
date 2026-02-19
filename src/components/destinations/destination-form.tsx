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
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                required
                defaultValue={destination?.name ?? ""}
              />
              {fieldErrors?.name && (
                <p className="text-sm text-destructive">
                  {fieldErrors.name[0]}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Typ</Label>
              <Select
                name="type"
                defaultValue={destination?.type ?? "other"}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hospital">Krankenhaus</SelectItem>
                  <SelectItem value="doctor">Arzt</SelectItem>
                  <SelectItem value="therapy">Therapie</SelectItem>
                  <SelectItem value="other">Sonstiges</SelectItem>
                </SelectContent>
              </Select>
              {fieldErrors?.type && (
                <p className="text-sm text-destructive">
                  {fieldErrors.type[0]}
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
          />

          <div className="space-y-2">
            <Label htmlFor="notes">Notizen</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={destination?.notes ?? ""}
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
              <Link href="/destinations">Abbrechen</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
