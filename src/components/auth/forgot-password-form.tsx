"use client"

import { useFormState } from "react-dom"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SubmitButton } from "@/components/shared/submit-button"
import { requestPasswordReset } from "@/actions/auth"
import Link from "next/link"

export function ForgotPasswordForm() {
  const [state, formAction] = useFormState(requestPasswordReset, null)

  return (
    <form action={formAction} className="space-y-4">
      {state && state.success && (
        <p className="text-sm text-green-600 bg-green-50 p-3 rounded-lg border border-green-100">
          {state.data}
        </p>
      )}
      
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
          placeholder="Ihre registrierte E-Mail-Adresse"
          disabled={state?.success}
        />
        {state && !state.success && state.fieldErrors?.email && (
          <p className="text-xs text-destructive">{state.fieldErrors.email[0]}</p>
        )}
      </div>

      <SubmitButton 
        pendingText="Wird gesendet..." 
        className="w-full"
        disabled={state?.success}
      >
        Link zum Zurücksetzen senden
      </SubmitButton>

      <div className="text-center">
        <Link 
          href="/login" 
          className="text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          Zurück zum Login
        </Link>
      </div>
    </form>
  )
}
