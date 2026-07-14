"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { decideAbsence } from "@/actions/absences"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

interface AbsenceDecisionActionsProps {
  absenceId: string
}

/**
 * Approve/reject controls for a single *requested* absence (Issue #103).
 *
 * Only rendered for `requested` absences (the parent gates on status). Calls
 * the `decideAbsence` server action directly via useTransition — it acts on a
 * single row id, so useFormState is unnecessary. The optional note is passed
 * with both decisions (useful especially for a rejection reason).
 */
export function AbsenceDecisionActions({
  absenceId,
}: AbsenceDecisionActionsProps): React.ReactElement {
  const { toast } = useToast()
  const router = useRouter()
  const [note, setNote] = useState("")
  const [pending, startTransition] = useTransition()
  const [activeDecision, setActiveDecision] = useState<
    "approved" | "rejected" | null
  >(null)

  function decide(decision: "approved" | "rejected"): void {
    setActiveDecision(decision)
    startTransition(async () => {
      const trimmed = note.trim()
      const result = await decideAbsence(
        absenceId,
        decision,
        trimmed === "" ? null : trimmed
      )
      if (result.success) {
        toast({
          title: decision === "approved" ? "Genehmigt" : "Abgelehnt",
          description:
            decision === "approved"
              ? "Die Abwesenheit wurde genehmigt. Der Fahrer wird per E-Mail informiert."
              : "Die Abwesenheit wurde abgelehnt. Der Fahrer wird per E-Mail informiert.",
        })
        router.refresh()
      } else {
        toast({
          variant: "destructive",
          title: "Fehler",
          description: result.error ?? "Entscheidung fehlgeschlagen.",
        })
      }
      setActiveDecision(null)
    })
  }

  const noteId = `absence-note-${absenceId}`

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={noteId} className="text-xs text-muted-foreground">
          Anmerkung (optional, wird dem Fahrer mitgeteilt)
        </Label>
        <Textarea
          id={noteId}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="z. B. Grund der Ablehnung"
          disabled={pending}
        />
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => decide("rejected")}
          className="min-h-[40px] border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
        >
          {pending && activeDecision === "rejected"
            ? "Wird abgelehnt…"
            : "Ablehnen"}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() => decide("approved")}
          className="min-h-[40px] bg-green-600 text-white hover:bg-green-700"
        >
          {pending && activeDecision === "approved"
            ? "Wird genehmigt…"
            : "Genehmigen"}
        </Button>
      </div>
    </div>
  )
}
