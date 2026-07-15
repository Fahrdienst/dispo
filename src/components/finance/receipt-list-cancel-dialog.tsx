"use client"

import { useState, useEffect, useTransition } from "react"
import { Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cancelReceipt } from "@/actions/receipt-cancel"
import { toast } from "@/hooks/use-toast"

interface CancelTarget {
  id: string
  receiptNumber: string
}

interface ReceiptListCancelDialogProps {
  target: CancelTarget | null
  onOpenChange: (open: boolean) => void
  onCancelled: () => void
}

/**
 * Storno dialog (Issue #149). The reason is a required field — the button stays
 * disabled until it is filled, and the server action + DB CHECK enforce it as
 * well (defence in depth).
 */
export function ReceiptListCancelDialog({
  target,
  onOpenChange,
  onCancelled,
}: ReceiptListCancelDialogProps) {
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Reset the field whenever a new receipt is targeted.
  useEffect(() => {
    if (target) {
      setReason("")
      setError(null)
    }
  }, [target])

  function handleSubmit() {
    setError(null)
    if (!target) return
    if (reason.trim().length < 3) {
      setError("Bitte geben Sie eine Storno-Begründung an (mind. 3 Zeichen).")
      return
    }

    startTransition(async () => {
      const result = await cancelReceipt({ receiptId: target.id, reason })
      if (!result.success) {
        setError(result.error ?? "Der Beleg konnte nicht storniert werden.")
        return
      }
      toast({
        title: "Beleg storniert",
        description:
          "Die zugehörigen Fahrten sind wieder quittierbar. Das PDF bleibt archiviert.",
      })
      onOpenChange(false)
      onCancelled()
    })
  }

  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Beleg stornieren</DialogTitle>
          <DialogDescription>
            {target
              ? `Quittung ${target.receiptNumber} stornieren. Der Beleg bleibt archiviert, die Fahrten werden wieder quittierbar.`
              : ""}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p
            className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="storno-reason">
            Begründung <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="storno-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Grund für die Stornierung..."
            rows={3}
            autoFocus
          />
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Abbrechen
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleSubmit}
            disabled={isPending || reason.trim().length < 3}
          >
            {isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            {isPending ? "Wird storniert..." : "Stornieren"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
