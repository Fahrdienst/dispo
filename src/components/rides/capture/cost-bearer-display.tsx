"use client"

// SLOT (#137): Kostenträger-Anzeige des gewählten Patienten (READ-ONLY).
//
// Der Kostenträger liegt ausschließlich am Patienten (#125). Auf der
// Erfassungsseite wird er nur ANGEZEIGT — es gibt KEIN Per-Fahrt-Select und
// KEINE Persistenz auf `rides`. Editiert wird der Kostenträger ausschließlich
// über die Patienten-Inline-Anlage/-Bearbeitung (#134); die Anzeige hier
// aktualisiert sich automatisch, sobald ein (anderer) Patient gewählt wird,
// da der Kern `patient` neu hereingibt.
//
// PII/Security: Kostenträger ist sensibel. Diese Seite ist staff-only
// (admin/operator, via requireAuth im Server Action / Page-Guard) — hier ist
// kein Fahrer-Sichtbarkeits-Thema. Nicht an Fahrer-/Auftragsblatt-Kopien ausgeben.

import { Wallet } from "lucide-react"
import { COST_BEARER_LABELS } from "@/lib/patients/constants"
import type { CapturePatient } from "./types"

export interface CostBearerDisplayProps {
  /** Currently selected patient, or null when none is chosen. */
  patient: CapturePatient | null
}

export function CostBearerDisplay({ patient }: CostBearerDisplayProps) {
  // No patient selected yet → nothing to show (no cost-bearer context).
  if (!patient) return null

  // Narrow on the value directly so the index access stays non-null.
  const bearer = patient.cost_bearer
  const isSet = bearer !== null
  const label = bearer ? COST_BEARER_LABELS[bearer] : "nicht gesetzt"

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2.5">
      <Wallet
        className="h-4 w-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <div className="flex flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Kostenträger
        </span>
        <span
          className={
            isSet
              ? "text-sm font-medium text-foreground"
              : "text-sm italic text-muted-foreground"
          }
        >
          {label}
        </span>
      </div>
      <span className="shrink-0 text-[11px] text-muted-foreground">
        über Patient pflegen
      </span>
    </div>
  )
}
