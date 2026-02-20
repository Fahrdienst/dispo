"use client"

import { useFormState } from "react-dom"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SubmitButton } from "@/components/shared/submit-button"
import { createZone, updateZone } from "@/actions/zones"
import type { Tables } from "@/lib/types/database"

interface ZoneFormProps {
  zone?: Tables<"zones">
}

export function ZoneForm({ zone }: ZoneFormProps) {
  const action = zone ? updateZone.bind(null, zone.id) : createZone

  const [state, formAction] = useFormState(action, null)

  const fieldErrors = state && !state.success ? state.fieldErrors : undefined

  return (
    <form action={formAction}>
      <Card>
        <CardHeader>
          <CardTitle>
            {zone ? "Zone bearbeiten" : "Neue Zone"}
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
              placeholder="z.B. Duebendorf, Zuerich Nord"
              defaultValue={zone?.name ?? ""}
            />
            {fieldErrors?.name && (
              <p className="text-sm text-destructive">{fieldErrors.name[0]}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Beschreibung</Label>
            <Textarea
              id="description"
              name="description"
              rows={3}
              placeholder="Optionale Beschreibung der Zone"
              defaultValue={zone?.description ?? ""}
            />
            {fieldErrors?.description && (
              <p className="text-sm text-destructive">
                {fieldErrors.description[0]}
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <SubmitButton>Speichern</SubmitButton>
            <Button variant="outline" asChild>
              <Link href="/settings/zones">Abbrechen</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
