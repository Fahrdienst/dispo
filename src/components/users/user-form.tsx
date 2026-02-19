"use client"

import { useState } from "react"
import { useFormState } from "react-dom"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SubmitButton } from "@/components/shared/submit-button"
import { createUser, updateUser } from "@/actions/users"
import type { Tables } from "@/lib/types/database"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface UserFormProps {
  user?: Tables<"profiles">
  drivers?: Pick<Tables<"drivers">, "id" | "first_name" | "last_name" | "is_active">[]
}

export function UserForm({ user, drivers = [] }: UserFormProps) {
  const action = user ? updateUser.bind(null, user.id) : createUser

  const [state, formAction] = useFormState(action, null)
  const [role, setRole] = useState(user?.role ?? "operator")

  const fieldErrors = state && !state.success ? state.fieldErrors : undefined

  return (
    <form action={formAction}>
      <Card>
        <CardHeader>
          <CardTitle>
            {user ? "Benutzer bearbeiten" : "Neuer Benutzer"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {state && !state.success && state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          {!user && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">E-Mail</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="off"
                />
                {fieldErrors?.email && (
                  <p className="text-sm text-destructive">
                    {fieldErrors.email[0]}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Passwort</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="new-password"
                />
                {fieldErrors?.password && (
                  <p className="text-sm text-destructive">
                    {fieldErrors.password[0]}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="display_name">Anzeigename</Label>
              <Input
                id="display_name"
                name="display_name"
                required
                defaultValue={user?.display_name ?? ""}
              />
              {fieldErrors?.display_name && (
                <p className="text-sm text-destructive">
                  {fieldErrors.display_name[0]}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Rolle</Label>
              <Select
                name="role"
                defaultValue={user?.role ?? "operator"}
                onValueChange={(value) => setRole(value as Tables<"profiles">["role"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="operator">Disponent</SelectItem>
                  <SelectItem value="driver">Fahrer</SelectItem>
                </SelectContent>
              </Select>
              {fieldErrors?.role && (
                <p className="text-sm text-destructive">
                  {fieldErrors.role[0]}
                </p>
              )}
            </div>
          </div>

          {role === "driver" && (
            <div className="space-y-2">
              <Label htmlFor="driver_id">Fahrer</Label>
              <Select
                name="driver_id"
                defaultValue={user?.driver_id ?? ""}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Fahrer auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {drivers.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.last_name}, {driver.first_name}
                      {!driver.is_active ? " (inaktiv)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors?.driver_id && (
                <p className="text-sm text-destructive">
                  {fieldErrors.driver_id[0]}
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <SubmitButton>Speichern</SubmitButton>
            <Button variant="outline" asChild>
              <Link href="/users">Abbrechen</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
