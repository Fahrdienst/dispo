"use client"

/**
 * SaveResultPanel — the post-save "never block" UX for the ride capture page
 * (Issue #139).
 *
 * Shown after `createRide` (#130) returns success WITHOUT redirecting, which
 * happens in two cases:
 *   1. non-blocking warnings were collected (missing geo/route/price/appointment)
 *   2. the user saved via "+ Auftragsblatt" (save_intent=order_sheet)
 *
 * It confirms the ride was saved, lists any warnings in a calm, informative
 * (not alarming) amber block making clear the ride is safe and fixable later,
 * and offers the two follow-up actions: continue to the day view or open the
 * M11 order sheet (/api/mail/preview) for the freshly created ride.
 */

import Link from "next/link"
import {
  CheckCircle2,
  Info,
  FileText,
  ArrowRight,
  Plus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ActionWarning } from "@/actions/shared"

export interface SaveResultPanelProps {
  /** Id of the freshly created (outbound / series-initial) ride. */
  rideId: string
  /** Ride date (YYYY-MM-DD) — target of the day-view continue link. */
  date: string
  /** Non-blocking warnings from #130; empty when the save was fully clean. */
  warnings: ActionWarning[]
}

export function SaveResultPanel({
  rideId,
  date,
  warnings,
}: SaveResultPanelProps) {
  const hasWarnings = warnings.length > 0

  return (
    <section
      className="space-y-4 rounded-lg border border-emerald-200 bg-emerald-50/70 p-4"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-2.5">
        <CheckCircle2
          className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600"
          aria-hidden="true"
        />
        <div className="space-y-0.5">
          <p className="font-semibold text-emerald-900">Fahrt gespeichert</p>
          <p className="text-sm text-emerald-800">
            {hasWarnings
              ? "Die Fahrt wurde gespeichert und kann jederzeit vervollständigt werden."
              : "Die Fahrt wurde erfolgreich erfasst."}
          </p>
        </div>
      </div>

      {hasWarnings && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center gap-2 text-amber-800">
            <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
            <p className="text-sm font-medium">
              Noch offen – ohne Auswirkung auf die Speicherung, später
              korrigierbar:
            </p>
          </div>
          <ul className="mt-2 space-y-1.5 text-sm text-amber-800">
            {warnings.map((warning) => (
              <li key={warning.code} className="flex gap-2">
                <span aria-hidden="true" className="select-none">
                  •
                </span>
                <span>{warning.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Button asChild>
          <Link href={`/rides?date=${date}`}>
            Weiter zur Übersicht
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <a
            href={`/api/mail/preview?ride_id=${rideId}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
            Auftragsblatt öffnen
          </a>
        </Button>
        {/*
          Full page navigation (not next/link) so the capture form remounts with
          a clean state for the next ride instead of keeping the saved result.
        */}
        <Button variant="ghost" asChild>
          <a href="/rides/erfassen">
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Weitere Fahrt erfassen
          </a>
        </Button>
      </div>
    </section>
  )
}
