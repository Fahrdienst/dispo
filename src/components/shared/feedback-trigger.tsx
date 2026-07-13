"use client"

import { useState } from "react"
import { MessageSquarePlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FeedbackDialog } from "@/components/shared/feedback-dialog"

interface FeedbackTriggerProps {
  /** Pre-fill the contact e-mail field (e.g. the logged-in user's address). */
  defaultEmail?: string
  /** Optional label override for the trigger button. */
  label?: string
}

/**
 * Self-contained feedback entry point: renders a button plus the feedback
 * dialog it controls. Drop it anywhere (e.g. into a header or menu) without
 * needing any surrounding overlay infrastructure.
 */
export function FeedbackTrigger({
  defaultEmail,
  label = "Feedback",
}: FeedbackTriggerProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="gap-2"
      >
        <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
        {label}
      </Button>
      <FeedbackDialog
        defaultEmail={defaultEmail}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
