"use client"

import { useFormStatus } from "react-dom"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

export interface SubmitButtonProps {
  children: React.ReactNode
  pendingText?: string
  className?: string
  disabled?: boolean
  variant?: "default" | "secondary" | "destructive" | "outline" | "ghost" | "link"
}

export function SubmitButton({
  children,
  pendingText = "Speichern...",
  className,
  disabled,
  variant,
}: SubmitButtonProps) {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" variant={variant} disabled={pending || disabled} aria-busy={pending} className={className}>
      {pending && (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          <span className="sr-only">Wird gespeichert</span>
        </>
      )}
      {pending ? pendingText : children}
    </Button>
  )
}
