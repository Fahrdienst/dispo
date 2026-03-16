"use client"

import { useState, useTransition } from "react"
import { ShieldAlert } from "lucide-react"
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
import { Button } from "@/components/ui/button"

interface AnonymizeDialogProps {
  entityId: string
  entityLabel: string
  onAnonymize: (id: string) => Promise<{ success?: string; error?: string }>
  onComplete: () => void
}

export function AnonymizeDialog({
  entityId,
  entityLabel,
  onAnonymize,
  onComplete,
}: AnonymizeDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  function handleConfirm() {
    setErrorMessage(null)
    startTransition(async () => {
      const result = await onAnonymize(entityId)
      if (result.error) {
        setErrorMessage(result.error)
      } else {
        onComplete()
      }
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="destructive"
          className="w-full"
          size="sm"
        >
          <ShieldAlert className="mr-2 h-4 w-4" />
          DSGVO-Loeschung
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Daten von {entityLabel} anonymisieren?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              Alle personenbezogenen Daten werden unwiderruflich anonymisiert.
              Diese Aktion kann nicht rueckgaengig gemacht werden.
            </span>
            <span className="block text-xs">
              Der Datensatz bleibt fuer Statistik und Abrechnung erhalten,
              aber alle personenbezogenen Felder werden durch Platzhalter ersetzt.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {errorMessage && (
          <p className="text-sm text-destructive">{errorMessage}</p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? "Wird anonymisiert..." : "Unwiderruflich anonymisieren"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
