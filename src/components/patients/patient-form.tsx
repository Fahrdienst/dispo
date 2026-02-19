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
            required
          />

          <fieldset className="space-y-4">
            <legend className="text-sm font-medium">Notfallkontakt</legend>
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

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Beeinträchtigungen</legend>
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
