"use client"

import { useEffect } from "react"
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
import { createDestinationInline } from "@/actions/destinations"
import { FACILITY_TYPE_LABELS } from "@/lib/rides/constants"
import type { Tables } from "@/lib/types/database"

interface DestinationInlineDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDestinationCreated: (
    destination: Pick<Tables<"destinations">, "id" | "display_name">
  ) => void
}

export function DestinationInlineDialog({
  open,
  onOpenChange,
  onDestinationCreated,
}: DestinationInlineDialogProps) {
  const [state, formAction] = useFormState(createDestinationInline, null)

  useEffect(() => {
    if (state?.success && state.data) {
      onDestinationCreated({
        id: state.data.id,
        display_name: state.data.display_name,
      })
      onOpenChange(false)
    }
  }, [state, onDestinationCreated, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neues Ziel</DialogTitle>
          <DialogDescription>
            Ziel schnell anlegen. Kontaktdaten und weitere Details koennen
            spaeter ergaenzt werden.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction}>
          <div className="space-y-4">
            {state && !state.success && state.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="inline_dest_display_name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="inline_dest_display_name"
                  name="display_name"
                  required
                  placeholder="z.B. Praxis Dr. Mueller"
                />
                {state &&
                  !state.success &&
                  state.fieldErrors?.display_name && (
                    <p className="text-sm text-destructive">
                      {state.fieldErrors.display_name[0]}
                    </p>
                  )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="inline_dest_facility_type">Typ</Label>
                <Select name="facility_type" defaultValue="other">
                  <SelectTrigger id="inline_dest_facility_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.entries(FACILITY_TYPE_LABELS) as [
                        string,
                        string,
                      ][]
                    ).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {state &&
                  !state.success &&
                  state.fieldErrors?.facility_type && (
                    <p className="text-sm text-destructive">
                      {state.fieldErrors.facility_type[0]}
                    </p>
                  )}
              </div>
            </div>

            <AddressFields
              errors={
                state && !state.success ? state.fieldErrors : undefined
              }
              required
              idPrefix="inline_dest"
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
                Ziel anlegen
              </SubmitButton>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
