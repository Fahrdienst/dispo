"use client"

import { useEffect, useRef } from "react"
import { useFormState, useFormStatus } from "react-dom"
import { updateOwnContact } from "@/actions/driver-self"
import { AddressFields } from "@/components/shared/address-fields"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import type { ActionResult } from "@/actions/shared"

interface ProfileFormProps {
  /**
   * Current DB values, used to pre-fill every field. Pre-filling the FULL set is
   * the null-wipe protection: the RPC overwrites all six columns, so the form
   * must always re-send unchanged values instead of blanks.
   */
  defaultValues: {
    phone: string | null
    email: string | null
    street: string | null
    house_number: string | null
    postal_code: string | null
    city: string | null
  }
}

function SubmitButton(): React.ReactElement {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      disabled={pending}
      className="h-12 w-full text-base"
    >
      {pending ? "Wird gespeichert…" : "Speichern"}
    </Button>
  )
}

export function ProfileForm({
  defaultValues,
}: ProfileFormProps): React.ReactElement {
  const { toast } = useToast()
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    updateOwnContact,
    null
  )
  const handledState = useRef<ActionResult | null>(null)

  useEffect(() => {
    if (!state || state === handledState.current) return
    handledState.current = state

    if (state.success) {
      toast({
        title: "Gespeichert",
        description: "Ihre Angaben wurden aktualisiert.",
      })
    } else if (!state.fieldErrors && state.error) {
      // Only surface non-field errors as a toast; field errors render inline.
      toast({
        variant: "destructive",
        title: "Fehler",
        description: state.error,
      })
    }
  }, [state, toast])

  const fieldErrors =
    state && !state.success ? state.fieldErrors : undefined

  return (
    <form action={formAction} className="space-y-6">
      <fieldset className="space-y-4">
        <legend className="text-sm font-medium">Kontakt</legend>

        <div className="space-y-2">
          <Label htmlFor="phone">Telefon</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            defaultValue={defaultValues.phone ?? ""}
            className="h-12 text-base"
          />
          {fieldErrors?.phone && (
            <p className="text-sm text-destructive">{fieldErrors.phone[0]}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">E-Mail</Label>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            defaultValue={defaultValues.email ?? ""}
            className="h-12 text-base"
          />
          {fieldErrors?.email && (
            <p className="text-sm text-destructive">{fieldErrors.email[0]}</p>
          )}
        </div>
      </fieldset>

      {/* AddressFields renders street/house_number/postal_code/city with the
          matching `name` attributes; uncontrolled defaultValue pre-fills them. */}
      <AddressFields defaultValues={defaultValues} errors={fieldErrors} />

      <SubmitButton />
    </form>
  )
}
