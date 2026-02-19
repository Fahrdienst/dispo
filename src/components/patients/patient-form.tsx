"use client"

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
import { createPatient, updatePatient } from "@/actions/patients"
import type { Tables } from "@/lib/types/database"

interface PatientFormProps {
  patient?: Tables<"patients">
}

export function PatientForm({ patient }: PatientFormProps) {
  const action = patient
    ? updatePatient.bind(null, patient.id)
    : createPatient

  const [state, formAction] = useFormState(action, null)

  const fieldErrors = state && !state.success ? state.fieldErrors : undefined

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

          <AddressFields
            defaultValues={patient}
            errors={fieldErrors}
          />

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Besondere Anforderungen</legend>
            <div className="flex items-center gap-2">
              <Checkbox
                id="needs_wheelchair"
                name="needs_wheelchair"
                defaultChecked={patient?.needs_wheelchair ?? false}
              />
              <Label htmlFor="needs_wheelchair" className="text-sm font-normal">
                Rollstuhl
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="needs_stretcher"
                name="needs_stretcher"
                defaultChecked={patient?.needs_stretcher ?? false}
              />
              <Label htmlFor="needs_stretcher" className="text-sm font-normal">
                Trage
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="needs_companion"
                name="needs_companion"
                defaultChecked={patient?.needs_companion ?? false}
              />
              <Label htmlFor="needs_companion" className="text-sm font-normal">
                Begleitperson
              </Label>
            </div>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="notes">Notizen</Label>
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
