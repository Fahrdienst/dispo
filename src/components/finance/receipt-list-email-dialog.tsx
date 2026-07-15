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
import { emailReceipt } from "@/actions/receipt-email"
import { toast } from "@/hooks/use-toast"

interface EmailTarget {
  id: string
  receiptNumber: string
  recipientEmail: string
}

interface ReceiptListEmailDialogProps {
  target: EmailTarget | null
  onOpenChange: (open: boolean) => void
}

/**
 * Send-by-email confirmation (Issue #151).
 *
 * SEC-M14-010: the recipient address is shown explicitly and must be confirmed
 * before a health-adjacent receipt leaves the system (a typo would be a
 * reportable data breach). The PDF is attached server-side, never linked.
 */
export function ReceiptListEmailDialog({
  target,
  onOpenChange,
}: ReceiptListEmailDialogProps) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (target) setError(null)
  }, [target])

  function handleSend() {
    setError(null)
    if (!target) return

    startTransition(async () => {
      const result = await emailReceipt(target.id)
      if (!result.success) {
        setError(result.error ?? "Die E-Mail konnte nicht versendet werden.")
        return
      }
      toast({
        title: "Quittung versendet",
        description: `Die Quittung ${target.receiptNumber} wurde an ${result.data.recipient} gesendet.`,
      })
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Quittung per E-Mail senden</DialogTitle>
          <DialogDescription>
            {target
              ? `Die Quittung ${target.receiptNumber} wird als PDF-Anhang versendet.`
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

        {target && (
          <div className="rounded-md border bg-muted/40 px-3 py-2.5 text-sm">
            <span className="text-muted-foreground">Empfänger:</span>{" "}
            <strong className="break-all">{target.recipientEmail}</strong>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Abbrechen
          </Button>
          <Button type="button" onClick={handleSend} disabled={isPending}>
            {isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            {isPending ? "Wird gesendet..." : "Senden"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
