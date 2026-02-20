"use client"

import { useFormState } from "react-dom"
import { useTransition } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SubmitButton } from "@/components/shared/submit-button"
import { addPostalCodesToZone, removePostalCodeFromZone } from "@/actions/zones"
import type { Tables } from "@/lib/types/database"

interface PostalCodesManagerProps {
  zoneId: string
  postalCodes: Tables<"zone_postal_codes">[]
}

export function PostalCodesManager({
  zoneId,
  postalCodes,
}: PostalCodesManagerProps) {
  const addAction = addPostalCodesToZone.bind(null, zoneId)
  const [addState, addFormAction] = useFormState(addAction, null)
  const [isPending, startTransition] = useTransition()

  function handleRemove(id: string) {
    startTransition(async () => {
      await removePostalCodeFromZone(id)
    })
  }

  const sorted = [...postalCodes].sort((a, b) =>
    a.postal_code.localeCompare(b.postal_code)
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Postleitzahlen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add postal codes form */}
        <form action={addFormAction} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="postal_codes">PLZ hinzufuegen</Label>
            <div className="flex gap-2">
              <Input
                id="postal_codes"
                name="postal_codes"
                placeholder="z.B. 8600, 8606, 8607"
                className="max-w-sm"
              />
              <SubmitButton>Hinzufuegen</SubmitButton>
            </div>
            <p className="text-xs text-muted-foreground">
              Mehrere PLZ mit Komma oder Leerzeichen trennen.
            </p>
          </div>
          {addState && !addState.success && addState.error && (
            <p className="text-sm text-destructive">{addState.error}</p>
          )}
          {addState && addState.success && (
            <p className="text-sm text-green-600">PLZ hinzugefuegt.</p>
          )}
        </form>

        {/* Current postal codes */}
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Keine PLZ zugeordnet. Fuegen Sie PLZ hinzu, um die Zone zu
            definieren.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sorted.map((pc) => (
              <span
                key={pc.id}
                className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1 text-sm font-medium"
              >
                {pc.postal_code}
                <button
                  type="button"
                  onClick={() => handleRemove(pc.id)}
                  disabled={isPending}
                  className="ml-1 text-muted-foreground hover:text-destructive disabled:opacity-50"
                  aria-label={`PLZ ${pc.postal_code} entfernen`}
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
