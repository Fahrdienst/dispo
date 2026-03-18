"use client"

import { useState } from "react"
import { useFormState } from "react-dom"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SubmitButton } from "@/components/shared/submit-button"
import { MfaVerifyForm } from "@/components/auth/mfa-verify-form"
import { login } from "@/actions/auth"

export function LoginForm() {
  const [state, formAction] = useFormState(login, null)
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null)
  const router = useRouter()

  // After successful login, check if MFA is required
  if (state?.success && state.data?.mfaRequired && state.data.factorId && !mfaFactorId) {
    // Trigger MFA step
    setMfaFactorId(state.data.factorId)
  }

  // Show MFA verification form
  if (mfaFactorId) {
    return (
      <MfaVerifyForm
        factorId={mfaFactorId}
        onSuccess={() => router.push("/")}
        onCancel={() => setMfaFactorId(null)}
      />
    )
  }

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
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Passwort</Label>
          <Link
            href="/login/forgot-password"
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            Passwort vergessen?
          </Link>
        </div>
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
