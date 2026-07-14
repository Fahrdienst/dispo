"use client"

/**
 * CaptureSaveActions — the two save buttons of the ride capture page (#139).
 *
 * Both are real submit buttons of the same form; they only differ by the
 * `save_intent` value carried into the FormData via the submitter:
 *   - "Speichern & zur Übersicht"  → save_intent=list       (primary)
 *   - "+ Auftragsblatt"            → save_intent=order_sheet (secondary)
 *
 * `createRide` (#130) redirects to the day view on the clean `list` path and
 * skips the redirect for `order_sheet` (or whenever warnings exist), so the
 * capture form can then show the post-save panel / open the M11 order sheet.
 *
 * Lives in its own component so `useFormStatus` reflects the parent form's
 * pending state (the hook must run inside the <form>, not in the form itself).
 */

import Link from "next/link"
import { useFormStatus } from "react-dom"
import { Loader2, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"

export function CaptureSaveActions() {
  const { pending } = useFormStatus()

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="submit"
          name="save_intent"
          value="list"
          disabled={pending}
          aria-busy={pending}
          className="flex-1"
        >
          {pending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          )}
          {pending ? "Speichern..." : "Speichern & zur Übersicht"}
        </Button>
        <Button
          type="submit"
          name="save_intent"
          value="order_sheet"
          variant="outline"
          disabled={pending}
          aria-busy={pending}
          className="flex-1"
        >
          <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
          Auftragsblatt
        </Button>
      </div>
      <Button variant="ghost" asChild className="w-full">
        <Link href="/rides">Abbrechen</Link>
      </Button>
    </div>
  )
}
