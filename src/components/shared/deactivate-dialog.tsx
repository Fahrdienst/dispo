"use client"

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

interface DeactivateDialogProps {
  isActive: boolean
  entityLabel: string
  onConfirm: () => void
  isPending: boolean
}

export function DeactivateDialog({
  isActive,
  entityLabel,
  onConfirm,
  isPending,
}: DeactivateDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant={isActive ? "destructive" : "outline"}
          disabled={isPending}
          className="w-full"
        >
          {isPending
            ? "Wird gespeichert..."
            : isActive
              ? "Deaktivieren"
              : "Aktivieren"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isActive
              ? `${entityLabel} deaktivieren?`
              : `${entityLabel} aktivieren?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isActive
              ? `${entityLabel} wird als inaktiv markiert und erscheint nicht mehr in Auswahllisten.`
              : `${entityLabel} wird wieder als aktiv markiert und erscheint in Auswahllisten.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {isActive ? "Deaktivieren" : "Aktivieren"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
