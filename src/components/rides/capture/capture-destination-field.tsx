"use client"

// SLOT (#134): Ziel-Such-/Auswahlfeld + Inline-"＋ neu"-Anlage.
// Functional stub reusing EntityCombobox (see capture-patient-field for the same
// pattern). Issue #134 owns the inline create dialog and richer result rendering
// (facility type, geocode status). Keep the props contract and the
// `name="destination_id"` hidden input stable.

import { useMemo } from "react"
import { EntityCombobox } from "@/components/shared/entity-combobox"
import type { CaptureDestination } from "./types"

export interface CaptureDestinationFieldProps {
  /** Selectable destinations (kept in the core for inline-created ones). */
  destinations: CaptureDestination[]
  /** Currently selected destination id, or null. */
  value: string | null
  /** Selection change handler. */
  onChange: (id: string | null) => void
  /** SLOT (#134): open the inline "neues Ziel" dialog. */
  onCreateNew?: () => void
  /** Field-level validation error from the server action. */
  error?: string
}

export function CaptureDestinationField({
  destinations,
  value,
  onChange,
  onCreateNew,
  error,
}: CaptureDestinationFieldProps) {
  const items = useMemo(
    () =>
      destinations.map((d) => ({
        id: d.id,
        label: d.display_name,
        sublabel: d.postal_code ?? undefined,
      })),
    [destinations]
  )

  return (
    <div className="space-y-1.5">
      <EntityCombobox
        items={items}
        value={value}
        onChange={onChange}
        name="destination_id"
        placeholder="Ziel suchen…"
        emptyMessage="Kein Ziel gefunden"
        aria-label="Ziel auswählen"
        onCreateNew={onCreateNew}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
