"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { cancelOwnAbsence } from "@/actions/absences"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface AbsenceCancelButtonProps {
  absenceId: string
}

/**
 * Withdraw a still-`requested` absence. Only rendered for absences where
 * `canDriverCancel(status)` is true, so the confirm copy assumes `requested`.
 */
export function AbsenceCancelButton({
  absenceId,
}: AbsenceCancelButtonProps): React.ReactElement {
  const { toast } = useToast()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleConfirm(): void {
    startTransition(async () => {
      const result = await cancelOwnAbsence(absenceId)
      if (result.success) {
        toast({
          title: "Antrag storniert",
          description: "Ihr Abwesenheitsantrag wurde zurückgezogen.",
        })
        router.refresh()
      } else {
        toast({
          variant: "destructive",
          title: "Fehler",
          description: result.error ?? "Stornierung fehlgeschlagen.",
        })
      }
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          className="min-h-[44px]"
        >
          {pending ? "Wird storniert…" : "Stornieren"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Antrag stornieren?</AlertDialogTitle>
          <AlertDialogDescription>
            Möchten Sie diesen Abwesenheitsantrag wirklich zurückziehen? Das
            lässt sich nicht rückgängig machen.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-[44px]">
            Abbrechen
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="min-h-[44px] bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Ja, stornieren
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
