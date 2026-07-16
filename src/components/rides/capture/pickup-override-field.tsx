"use client"

// SLOT (#138): Abhol-Ort-Override auf der Erfassungsseite.
//
// Default = die Patienten-Wohnadresse (read-only-Anmutung). Ein Toggle
// "Anderer Abholort" blendet ein Freitext-Feld ein. Bei tatsaechlichem Override
// wird die Adresse geocodiert — Marco-Constraint: NUR bei Override, und NICHT
// pro Tastendruck. Wir geocoden on-blur bzw. per "Adresse prüfen"-Button und
// cachen das Ergebnis (lastGeocodedText), sodass unveraenderter Text nicht
// erneut die (kostenpflichtige) Geocoding-API trifft. Das Ergebnis wird per
// onChange nach oben gereicht; der Route-Start/Preis startet dann am Override.
//
// Ohne Override ruft diese Komponente KEINE Maps-API auf.

import { useCallback, useRef, useState, useTransition } from "react"
import { MapPin, Check, Loader2, Pencil, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { geocodePickupLocation } from "@/actions/rides"
import type { CapturePatient, PickupOverride } from "./types"

export interface PickupOverrideFieldProps {
  /** Selected patient — provides the home address shown as the default. */
  patient: CapturePatient | null
  /** Current override, or null = use the patient's home address (default). */
  value: PickupOverride | null
  /** Emits the geocoded override, or null when reverting to the home address. */
  onChange: (value: PickupOverride | null) => void
}

/** Build a one-line home address from the patient's structured fields. */
function formatHomeAddress(patient: CapturePatient | null): string | null {
  if (!patient) return null
  const streetPart = [patient.street, patient.house_number]
    .filter(Boolean)
    .join(" ")
    .trim()
  const cityPart = [patient.postal_code, patient.city]
    .filter(Boolean)
    .join(" ")
    .trim()
  const full = [streetPart, cityPart].filter(Boolean).join(", ")
  return full.length > 0 ? full : null
}

export function PickupOverrideField({
  patient,
  value,
  onChange,
}: PickupOverrideFieldProps) {
  const homeAddress = formatHomeAddress(patient)

  // "override" mode is on whenever a value exists OR the dispatcher opened the
  // field. Kept in local state so opening the field (before geocoding) works.
  const [overrideOpen, setOverrideOpen] = useState<boolean>(value !== null)
  const [text, setText] = useState<string>(value?.text ?? "")
  const [error, setError] = useState<string | null>(null)
  const [isGeocoding, startGeocoding] = useTransition()

  // Cache: last text we successfully geocoded — avoids re-hitting the API when
  // the input is unchanged (blur without edit, double-click on "prüfen").
  const lastGeocodedText = useRef<string | null>(value?.text ?? null)
  // [Marco P2] Cache failed lookups too — re-blurring an unresolvable string
  // must not fire repeated (billable) geocoding calls.
  const lastFailedText = useRef<string | null>(null)

  const runGeocode = useCallback(() => {
    const trimmed = text.trim()
    if (trimmed.length < 3) {
      setError("Bitte geben Sie eine vollständige Adresse ein.")
      return
    }
    // Cached: same text already resolved into the current value → skip the call.
    if (trimmed === lastGeocodedText.current && value !== null) {
      return
    }
    // [Marco P2] Same text already failed → don't re-hit the API for a string we
    // already know does not resolve (blur without edit, double-click on "prüfen").
    if (trimmed === lastFailedText.current) {
      return
    }
    startGeocoding(async () => {
      setError(null)
      const result = await geocodePickupLocation(trimmed)
      if (result.success) {
        lastGeocodedText.current = trimmed
        lastFailedText.current = null
        onChange({
          text: result.data.formatted_address || trimmed,
          lat: result.data.lat,
          lng: result.data.lng,
          place_id: result.data.place_id,
        })
      } else {
        // Non-blocking: surface the reason, drop any stale coordinates so the
        // route/price fall back to the home address, and remember the failed
        // string so we don't re-geocode it.
        lastGeocodedText.current = null
        lastFailedText.current = trimmed
        setError(result.error ?? "Geocoding fehlgeschlagen.")
        onChange(null)
      }
    })
  }, [text, value, onChange])

  const enableOverride = useCallback(() => {
    setOverrideOpen(true)
  }, [])

  const revertToHome = useCallback(() => {
    setOverrideOpen(false)
    setText("")
    setError(null)
    lastGeocodedText.current = null
    onChange(null)
  }, [onChange])

  const isResolved = value !== null

  return (
    <div className="space-y-2">
      <Label>Abholort</Label>

      {!overrideOpen ? (
        // --- Default: patient home address, read-only look ---
        <div className="flex items-start justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
          <div className="flex items-start gap-2 text-sm">
            <Home
              className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span>
              {homeAddress ? (
                <>
                  <span className="font-medium text-foreground">
                    {homeAddress}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Wohnadresse des Patienten
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">
                  {patient
                    ? "Keine Wohnadresse hinterlegt."
                    : "Bitte zuerst einen Patienten wählen."}
                </span>
              )}
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 shrink-0 px-2 text-xs"
            onClick={enableOverride}
          >
            <Pencil className="mr-1 h-3 w-3" aria-hidden="true" />
            Anderer Abholort
          </Button>
        </div>
      ) : (
        // --- Override: free-text address + geocode ---
        <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label
                htmlFor="pickup_override_text"
                className="text-xs text-muted-foreground"
              >
                Abweichende Abhol-Adresse
              </Label>
              <Input
                id="pickup_override_text"
                type="text"
                value={text}
                placeholder="Strasse Nr, PLZ Ort"
                autoComplete="off"
                onChange={(e) => {
                  const next = e.target.value
                  setText(next)
                  setError(null)
                  // [Marco P1] Editing the text invalidates the previously
                  // geocoded coordinates, so the form can never submit a stale
                  // origin (wrong distance/price). The changed text must be
                  // re-confirmed (blur / "Adresse prüfen") before it resolves.
                  if (value !== null && next.trim() !== lastGeocodedText.current) {
                    lastGeocodedText.current = null
                    lastFailedText.current = null
                    onChange(null)
                  }
                }}
                onBlur={runGeocode}
                aria-invalid={error !== null}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-9 shrink-0"
              onClick={runGeocode}
              disabled={isGeocoding}
            >
              {isGeocoding ? (
                <Loader2
                  className="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                "Adresse prüfen"
              )}
            </Button>
          </div>

          {isResolved && !isGeocoding && (
            <p className="flex items-start gap-1.5 text-xs text-emerald-700">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                Abholort gesetzt:{" "}
                <span className="font-medium">{value.text}</span>
              </span>
            </p>
          )}

          {error && (
            <p className="flex items-start gap-1.5 text-xs text-amber-700" role="alert">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </p>
          )}

          <button
            type="button"
            onClick={revertToHome}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-ring/40"
          >
            Zurück zur Wohnadresse
          </button>
        </div>
      )}
    </div>
  )
}
