"use client"

import { useFormState } from "react-dom"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SubmitButton } from "@/components/shared/submit-button"
import { changePassword } from "@/actions/auth"
import { toast } from "@/hooks/use-toast"
import { useEffect, useRef } from "react"

export function ChangePasswordForm() {
  const [state, formAction] = useFormState(changePassword, null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state?.success && state.data) {
      toast({
        title: "Erfolg",
        description: state.data as string,
      })
      formRef.current?.reset()
    }
  }, [state])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Passwort ändern</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} ref={formRef} className="space-y-4">
          {state && !state.success && state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <div className="space-y-2">
            <Label htmlFor="password">Neues Passwort</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
            />
            {state && !state.success && state.fieldErrors?.password && (
              <p className="text-sm text-destructive">
                {state.fieldErrors.password[0]}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Passwort bestätigen</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
            />
            {state && !state.success && state.fieldErrors?.confirmPassword && (
              <p className="text-sm text-destructive">
                {state.fieldErrors.confirmPassword[0]}
              </p>
            )}
          </div>

          <SubmitButton variant="secondary">Passwort aktualisieren</SubmitButton>
        </form>
      </CardContent>
    </Card>
  )
}
