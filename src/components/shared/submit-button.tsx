"use client"

import { useFormStatus } from "react-dom"
import { Button } from "@/components/ui/button"

interface SubmitButtonProps {
  children: React.ReactNode
  pendingText?: string
}

export function SubmitButton({
  children,
  pendingText = "Speichern...",
}: SubmitButtonProps) {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingText : children}
    </Button>
  )
}
