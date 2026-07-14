"use client"

// SLOT (#134): Patient-Such-/Auswahlfeld + Inline-"＋ neu"-Anlage.
// This functional stub already reuses the shared EntityCombobox so the capture
// page is usable today. Issue #134 owns the inline create flow (wire the
// `onCreateNew` dialog + append the created patient to the list) and any richer
// result rendering (address preview, geocode status). Keep the props contract
// and the `name="patient_id"` hidden input stable so the core keeps submitting.

import { useMemo } from "react"
import { EntityCombobox } from "@/components/shared/entity-combobox"
import type { CapturePatient } from "./types"

export interface CapturePatientFieldProps {
  /** Selectable patients (kept in the core so inline-created ones can be added). */
  patients: CapturePatient[]
  /** Currently selected patient id, or null. */
  value: string | null
  /** Selection change handler. */
  onChange: (id: string | null) => void
  /** SLOT (#134): open the inline "neuer Patient" dialog. */
  onCreateNew?: () => void
  /** Field-level validation error from the server action. */
  error?: string
  /** Auto-focus on mount (first field in the phone-call flow). */
  autoFocus?: boolean
}

export function CapturePatientField({
  patients,
  value,
  onChange,
  onCreateNew,
  error,
  autoFocus = false,
}: CapturePatientFieldProps) {
  const items = useMemo(
    () =>
      patients.map((p) => ({
        id: p.id,
        label: `${p.last_name}, ${p.first_name}`,
      })),
    [patients]
  )

  return (
    <div className="space-y-1.5">
      <EntityCombobox
        items={items}
        value={value}
        onChange={onChange}
        name="patient_id"
        placeholder="Patient suchen…"
        emptyMessage="Kein Patient gefunden"
        autoFocus={autoFocus}
        aria-label="Patient auswählen"
        onCreateNew={onCreateNew}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
