"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { REJECTION_REASON_LABELS } from "@/lib/acceptance/constants"
import { rejectAssignment } from "@/actions/acceptance"
import type { RejectionReason } from "@/lib/acceptance/types"

const REJECTION_REASONS: RejectionReason[] = [
  "schedule_conflict",
  "too_far",
  "vehicle_issue",
  "personal",
  "other",
]

interface RejectionDialogProps {
  rideId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RejectionDialog({
  rideId,
  open,
  onOpenChange,
}: RejectionDialogProps) {
  const [reason, setReason] = useState<string>("")
  const [reasonText, setReasonText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit() {
    if (!reason) {
      setError("Bitte waehlen Sie einen Ablehnungsgrund")
      return
    }

    setError(null)
    startTransition(async () => {
      const result = await rejectAssignment(
        rideId,
        reason,
        reasonText || undefined
      )
      if (result.success) {
        onOpenChange(false)
        router.refresh()
      } else {
        setError(result.error ?? "Fehler beim Ablehnen")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fahrt ablehnen</DialogTitle>
          <DialogDescription>
            Bitte geben Sie einen Grund fuer die Ablehnung an.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="rejection-reason">Ablehnungsgrund</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="rejection-reason">
                <SelectValue placeholder="Grund auswählen..." />
              </SelectTrigger>
              <SelectContent>
                {REJECTION_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {REJECTION_REASON_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rejection-text">
              Zusaetzliche Anmerkung{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="rejection-text"
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value.slice(0, 200))}
              placeholder="Weitere Details..."
              maxLength={200}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              {reasonText.length}/200 Zeichen
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Abbrechen
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={isPending}
          >
            {isPending ? "Wird abgelehnt..." : "Ablehnen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
