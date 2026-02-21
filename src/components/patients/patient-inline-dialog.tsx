"use client"

import { useEffect } from "react"
import { useFormState } from "react-dom"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { SubmitButton } from "@/components/shared/submit-button"
import { AddressFields } from "@/components/shared/address-fields"
import { createPatientInline } from "@/actions/patients"
import type { Tables } from "@/lib/types/database"

interface PatientInlineDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPatientCreated: (
    patient: Pick<Tables<"patients">, "id" | "first_name" | "last_name">
  ) => void
}

export function PatientInlineDialog({
  open,
  onOpenChange,
  onPatientCreated,
}: PatientInlineDialogProps) {
  const [state, formAction] = useFormState(createPatientInline, null)

  useEffect(() => {
    if (state?.success && state.data) {
      onPatientCreated({
        id: state.data.id,
        first_name: state.data.first_name,
        last_name: state.data.last_name,
      })
      onOpenChange(false)
    }
  }, [state, onPatientCreated, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neuer Patient</DialogTitle>
          <DialogDescription>
            Patient schnell anlegen. Weitere Details koennen spaeter ergaenzt
            werden.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction}>
          <div className="space-y-4">
            {state && !state.success && state.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="inline_patient_first_name">
                  Vorname <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="inline_patient_first_name"
                  name="first_name"
                  required
                />
                {state &&
                  !state.success &&
                  state.fieldErrors?.first_name && (
                    <p className="text-sm text-destructive">
                      {state.fieldErrors.first_name[0]}
                    </p>
                  )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="inline_patient_last_name">
                  Nachname <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="inline_patient_last_name"
                  name="last_name"
                  required
                />
                {state &&
                  !state.success &&
                  state.fieldErrors?.last_name && (
                    <p className="text-sm text-destructive">
                      {state.fieldErrors.last_name[0]}
                    </p>
                  )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="inline_patient_phone">Telefon</Label>
              <Input id="inline_patient_phone" name="phone" />
              {state && !state.success && state.fieldErrors?.phone && (
                <p className="text-sm text-destructive">
                  {state.fieldErrors.phone[0]}
                </p>
              )}
            </div>

            <AddressFields
              errors={
                state && !state.success ? state.fieldErrors : undefined
              }
              required
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Abbrechen
              </Button>
              <SubmitButton pendingText="Erstelle...">
                Patient anlegen
              </SubmitButton>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
