"use client"

import { useState, useTransition } from "react"
import { useFormState } from "react-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react"
import { enrollMFA, verifyMFA, unenrollMFA } from "@/actions/mfa"

interface MfaSettingsProps {
  initialEnabled: boolean
  initialFactorId: string | null
}

type MfaStep = "idle" | "enrolling" | "verifying"

interface EnrollData {
  factorId: string
  qrCode: string
  secret: string
}

export function MfaSettings({ initialEnabled, initialFactorId }: MfaSettingsProps) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [factorId, setFactorId] = useState(initialFactorId)
  const [step, setStep] = useState<MfaStep>("idle")
  const [enrollData, setEnrollData] = useState<EnrollData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const [verifyState, verifyAction] = useFormState(verifyMFA, null)

  // Handle successful verification
  if (verifyState?.success && step === "verifying" && enrollData) {
    setEnabled(true)
    setFactorId(enrollData.factorId)
    setStep("idle")
    setEnrollData(null)
    // Reset verify state by moving to idle
  }

  function handleStartEnroll() {
    setError(null)
    startTransition(async () => {
      const result = await enrollMFA()
      if (result.success) {
        setEnrollData({
          factorId: result.data.factorId,
          qrCode: result.data.qrCode,
          secret: result.data.secret,
        })
        setStep("verifying")
      } else {
        setError(result.error ?? "Fehler bei der MFA-Registrierung")
      }
    })
  }

  function handleUnenroll() {
    if (!factorId) return
    setError(null)
    startTransition(async () => {
      const result = await unenrollMFA(factorId)
      if (result.success) {
        setEnabled(false)
        setFactorId(null)
        setStep("idle")
      } else {
        setError(result.error ?? "Fehler bei der MFA-Deaktivierung")
      }
    })
  }

  function handleCancel() {
    // If we enrolled but haven't verified, the unverified factor
    // will be cleaned up automatically by Supabase
    setStep("idle")
    setEnrollData(null)
    setError(null)
  }

  return (
    <div className="space-y-6">
      {/* Status Section */}
      <div className="rounded-lg border p-6">
        <div className="flex items-center gap-3">
          {enabled ? (
            <ShieldCheck className="h-8 w-8 text-green-600" />
          ) : (
            <ShieldOff className="h-8 w-8 text-muted-foreground" />
          )}
          <div>
            <h3 className="text-lg font-medium">
              Zwei-Faktor-Authentifizierung (2FA)
            </h3>
            <p className="text-sm text-muted-foreground">
              {enabled
                ? "2FA ist aktiv. Ihr Konto ist zusätzlich geschützt."
                : "2FA ist nicht aktiviert. Aktivieren Sie 2FA für zusätzlichen Schutz."}
            </p>
          </div>
        </div>

        {error && (
          <p className="mt-4 text-sm text-destructive">{error}</p>
        )}

        {/* Idle state: show enable/disable button */}
        {step === "idle" && (
          <div className="mt-6">
            {enabled ? (
              <Button
                variant="destructive"
                onClick={handleUnenroll}
                disabled={isPending}
              >
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                2FA deaktivieren
              </Button>
            ) : (
              <Button onClick={handleStartEnroll} disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                2FA aktivieren
              </Button>
            )}
          </div>
        )}

        {/* Verifying state: show QR code + code input */}
        {step === "verifying" && enrollData && (
          <div className="mt-6 space-y-6">
            <div className="rounded-lg border bg-muted/50 p-6">
              <h4 className="mb-4 font-medium">
                1. Scannen Sie den QR-Code mit Ihrer Authenticator-App
              </h4>
              <div className="flex justify-center">
                {/* QR code is a data URI from Supabase */}
                <img
                  src={enrollData.qrCode}
                  alt="QR-Code für die Authenticator-App"
                  width={200}
                  height={200}
                  className="rounded-lg"
                />
              </div>
              <div className="mt-4">
                <p className="text-xs text-muted-foreground">
                  Alternativ können Sie diesen Schlüssel manuell eingeben:
                </p>
                <code className="mt-1 block break-all rounded bg-muted px-3 py-2 text-xs font-mono">
                  {enrollData.secret}
                </code>
              </div>
            </div>

            <div className="rounded-lg border p-6">
              <h4 className="mb-4 font-medium">
                2. Geben Sie den Code aus der App ein
              </h4>
              <form action={verifyAction} className="space-y-4">
                <input type="hidden" name="factorId" value={enrollData.factorId} />

                {verifyState && !verifyState.success && verifyState.error && (
                  <p className="text-sm text-destructive">{verifyState.error}</p>
                )}

                <div className="space-y-2">
                  <Label htmlFor="setup-code">Authentifizierungscode</Label>
                  <Input
                    id="setup-code"
                    name="code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    maxLength={6}
                    pattern="[0-9]{6}"
                    placeholder="000000"
                    className="max-w-xs text-center text-xl tracking-[0.5em] font-mono"
                    required
                  />
                </div>

                <div className="flex gap-2">
                  <Button type="submit">
                    Bestätigen
                  </Button>
                  <Button type="button" variant="ghost" onClick={handleCancel}>
                    Abbrechen
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="rounded-lg border bg-muted/30 p-6">
        <h4 className="mb-2 font-medium">Was ist 2FA?</h4>
        <p className="text-sm text-muted-foreground">
          Die Zwei-Faktor-Authentifizierung fügt eine zusätzliche
          Sicherheitsebene hinzu. Nach der Eingabe Ihres Passworts müssen Sie
          einen zeitbasierten Code aus einer Authenticator-App eingeben (z.B.
          Google Authenticator, Authy oder 1Password).
        </p>
      </div>
    </div>
  )
}
