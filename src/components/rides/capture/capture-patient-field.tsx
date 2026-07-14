"use client"

// Patient search/select field + inline "＋ neu anlegen" flow (#134).
// Reuses the shared EntityCombobox for search and the existing
// PatientInlineDialog (which since #125 also captures cost_bearer) for the
// quick-create. The dialog is owned here; on creation we hand the new patient
// up via `onCreateNew` so the core appends it to its list AND selects it, which
// in turn triggers the route/price recalculation. Keep the `name="patient_id"`
// hidden input (inside EntityCombobox) stable so the core keeps submitting.

import { useMemo, useState, useCallback } from "react"
import { EntityCombobox } from "@/components/shared/entity-combobox"
import { PatientInlineDialog } from "@/components/patients/patient-inline-dialog"
import type { CapturePatient } from "./types"

export interface CapturePatientFieldProps {
  /** Selectable patients (kept in the core so inline-created ones can be added). */
  patients: CapturePatient[]
  /** Currently selected patient id, or null. */
  value: string | null
  /** Selection change handler. */
  onChange: (id: string | null) => void
  /**
   * Called with the inline-created patient. The core appends it to its patient
   * list and selects it. When omitted, the "＋ Neu anlegen" action is hidden.
   */
  onCreateNew?: (patient: CapturePatient) => void
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
  const [dialogOpen, setDialogOpen] = useState(false)

  const items = useMemo(
    () =>
      patients.map((p) => ({
        id: p.id,
        label: `${p.last_name}, ${p.first_name}`,
      })),
    [patients]
  )

  const handleCreated = useCallback(
    (patient: { id: string; first_name: string; last_name: string }) => {
      // The inline dialog forwards only id + name; cost_bearer is not part of
      // its callback contract, so it defaults to null here. The value is
      // re-hydrated on the next reload (createPatientInline revalidates).
      onCreateNew?.({
        id: patient.id,
        first_name: patient.first_name,
        last_name: patient.last_name,
        cost_bearer: null,
      })
    },
    [onCreateNew]
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
        onCreateNew={onCreateNew ? () => setDialogOpen(true) : undefined}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      {onCreateNew && (
        <PatientInlineDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onPatientCreated={handleCreated}
        />
      )}
    </div>
  )
}
