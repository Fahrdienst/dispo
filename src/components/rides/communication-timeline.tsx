"use client"

import { useRef, useEffect } from "react"
import { useFormState } from "react-dom"
import { Textarea } from "@/components/ui/textarea"
import { SubmitButton } from "@/components/shared/submit-button"
import { addMessage } from "@/actions/communication-log"
import type { ActionResult } from "@/actions/shared"

interface Message {
  id: string
  message: string
  created_at: string
  author: {
    display_name: string
  } | null
}

interface CommunicationTimelineProps {
  messages: Message[]
  rideId: string
}

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function CommunicationTimeline({
  messages,
  rideId,
}: CommunicationTimelineProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const boundAction = addMessage.bind(null, rideId)
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    boundAction,
    null
  )

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset()
    }
  }, [state])

  return (
    <div className="space-y-6">
      {/* Message list */}
      {messages.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Noch keine Nachrichten vorhanden.
        </p>
      ) : (
        <div className="space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className="flex gap-3">
              {/* Timeline dot and line */}
              <div className="flex flex-col items-center">
                <div className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                <div className="w-px flex-1 bg-border" />
              </div>

              {/* Message content */}
              <div className="flex-1 pb-4">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium">
                    {msg.author?.display_name ?? "Unbekannt"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatTimestamp(msg.created_at)}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">
                  {msg.message}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Input form */}
      <form ref={formRef} action={formAction} className="space-y-3">
        <Textarea
          name="message"
          placeholder="Nachricht eingeben..."
          rows={3}
          required
          minLength={1}
          maxLength={2000}
        />

        {state && !state.success && state.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}
        {state && !state.success && state.fieldErrors?.message && (
          <p className="text-sm text-destructive">
            {state.fieldErrors.message[0]}
          </p>
        )}

        <SubmitButton pendingText="Senden...">Nachricht senden</SubmitButton>
      </form>
    </div>
  )
}
