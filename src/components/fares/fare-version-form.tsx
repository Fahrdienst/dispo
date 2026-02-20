"use client"

import { useFormState } from "react-dom"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SubmitButton } from "@/components/shared/submit-button"
import { createFareVersion, updateFareVersion } from "@/actions/fares"
import type { Tables } from "@/lib/types/database"

interface FareVersionFormProps {
  fareVersion?: Tables<"fare_versions">
}

export function FareVersionForm({ fareVersion }: FareVersionFormProps) {
  const action = fareVersion
    ? updateFareVersion.bind(null, fareVersion.id)
    : createFareVersion

  const [state, formAction] = useFormState(action, null)

  const fieldErrors = state && !state.success ? state.fieldErrors : undefined

  return (
    <form action={formAction}>
      <Card>
        <CardHeader>
          <CardTitle>
            {fareVersion ? "Tarifversion bearbeiten" : "Neue Tarifversion"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {state && !state.success && state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          {state && state.success && (
            <p className="text-sm text-green-600">Gespeichert.</p>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              name="name"
              required
              placeholder="z.B. Tarif 2026 Q1"
              defaultValue={fareVersion?.name ?? ""}
            />
            {fieldErrors?.name && (
              <p className="text-sm text-destructive">{fieldErrors.name[0]}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="valid_from">
                Gueltig ab <span className="text-destructive">*</span>
              </Label>
              <Input
                id="valid_from"
                name="valid_from"
                type="date"
                required
                defaultValue={fareVersion?.valid_from ?? ""}
              />
              {fieldErrors?.valid_from && (
                <p className="text-sm text-destructive">
                  {fieldErrors.valid_from[0]}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="valid_to">Gueltig bis</Label>
              <Input
                id="valid_to"
                name="valid_to"
                type="date"
                defaultValue={fareVersion?.valid_to ?? ""}
              />
              <p className="text-xs text-muted-foreground">
                Leer lassen fuer unbegrenzte Gueltigkeit.
              </p>
              {fieldErrors?.valid_to && (
                <p className="text-sm text-destructive">
                  {fieldErrors.valid_to[0]}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <SubmitButton>Speichern</SubmitButton>
            <Button variant="outline" asChild>
              <Link href="/settings/fares">Abbrechen</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
