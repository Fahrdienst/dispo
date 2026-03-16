"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { verifyMFALogin } from "@/actions/mfa"

interface MfaVerifyFormProps {
  factorId: string
  onSuccess: () => void
  onCancel: () => void
}

export function MfaVerifyForm({
  factorId,
  onSuccess,
  onCancel,
}: MfaVerifyFormProps) {
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)

    const result = await verifyMFALogin(factorId, code)

    if (result.success) {
      onSuccess()
    } else {
      setError(result.error ?? "Verifizierung fehlgeschlagen")
      setCode("")
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center">
        <h2 className="text-lg font-semibold text-foreground">
          Zwei-Faktor-Authentifizierung
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Geben Sie den Code aus Ihrer Authenticator-App ein
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="space-y-2">
        <Label htmlFor="mfa-code">Authentifizierungscode</Label>
        <Input
          id="mfa-code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={6}
          pattern="[0-9]{6}"
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className="text-center text-2xl tracking-[0.5em] font-mono"
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Button type="submit" disabled={pending || code.length !== 6} className="w-full">
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {pending ? "Wird geprüft..." : "Bestätigen"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={pending}
          className="w-full"
        >
          Abbrechen
        </Button>
      </div>
    </form>
  )
}
