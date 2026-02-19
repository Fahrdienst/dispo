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
                defaultValue={driver?.first_name ?? ""}
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
                defaultValue={driver?.last_name ?? ""}
              />
              {fieldErrors?.last_name && (
                <p className="text-sm text-destructive">
                  {fieldErrors.last_name[0]}
                </p>
              )}
            </div>
          </div>

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
                <p className="text-sm text-destructive">
                  {fieldErrors.phone[0]}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicle_type">Fahrzeugtyp</Label>
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
                <p className="text-sm text-destructive">
                  {fieldErrors.vehicle_type[0]}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notizen</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={driver?.notes ?? ""}
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
              <Link href="/drivers">Abbrechen</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
