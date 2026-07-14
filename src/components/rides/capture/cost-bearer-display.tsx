"use client"

// SLOT (#137): Kostenträger-Anzeige des gewählten Patienten.
// Functional stub: shows the patient's cost bearer as a small badge (read-only
// context for the dispatcher). Issue #137 can enrich this (e.g. billing hints,
// warnings for self-payers). Keep the props contract stable.

import { Wallet } from "lucide-react"
import { COST_BEARER_LABELS } from "@/lib/patients/constants"
import type { CapturePatient } from "./types"

export interface CostBearerDisplayProps {
  /** Currently selected patient, or null when none is chosen. */
  patient: CapturePatient | null
}

export function CostBearerDisplay({ patient }: CostBearerDisplayProps) {
  if (!patient) return null

  const label = patient.cost_bearer
    ? COST_BEARER_LABELS[patient.cost_bearer]
    : "Kein Kostenträger hinterlegt"

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Wallet className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>
        Kostenträger:{" "}
        <span className={patient.cost_bearer ? "font-medium text-foreground" : ""}>
          {label}
        </span>
      </span>
    </div>
  )
}
