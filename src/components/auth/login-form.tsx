"use client"

import { useFormState } from "react-dom"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SubmitButton } from "@/components/shared/submit-button"
import { login } from "@/actions/auth"

export function LoginForm() {
  const [state, formAction] = useFormState(login, null)

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.success && state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">E-Mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Passwort</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>

      <SubmitButton pendingText="Anmelden..." className="w-full">Anmelden</SubmitButton>
    </form>
  )
}
