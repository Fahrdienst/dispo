"use client"

// Destination search/select field + inline "＋ neu anlegen" flow (#134).
// Same pattern as capture-patient-field: reuses the shared EntityCombobox and
// the existing DestinationInlineDialog (with fire-and-forget geocoding). The
// dialog is owned here; on creation we hand the new destination up via
// `onCreateNew` so the core appends it + selects it, triggering the route/price
// recalculation. Keep the `name="destination_id"` hidden input stable.

import { useMemo, useState, useCallback } from "react"
import { EntityCombobox } from "@/components/shared/entity-combobox"
import { DestinationInlineDialog } from "@/components/destinations/destination-inline-dialog"
import type { CaptureDestination } from "./types"

export interface CaptureDestinationFieldProps {
  /** Selectable destinations (kept in the core for inline-created ones). */
  destinations: CaptureDestination[]
  /** Currently selected destination id, or null. */
  value: string | null
  /** Selection change handler. */
  onChange: (id: string | null) => void
  /**
   * Called with the inline-created destination. The core appends it to its
   * destination list and selects it. When omitted, the "＋ Neu anlegen" action
   * is hidden.
   */
  onCreateNew?: (destination: CaptureDestination) => void
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
  const [dialogOpen, setDialogOpen] = useState(false)

  const items = useMemo(
    () =>
      destinations.map((d) => ({
        id: d.id,
        label: d.display_name,
        sublabel: d.postal_code ?? undefined,
      })),
    [destinations]
  )

  const handleCreated = useCallback(
    (destination: { id: string; display_name: string }) => {
      // The inline dialog forwards only id + display_name; postal_code is not
      // part of its callback contract, so it defaults to null here (matches the
      // edit-flow ride-form). Zone/price re-hydrate on the next reload; missing
      // coordinates never block (best-effort geocoding, warned in D1).
      onCreateNew?.({
        id: destination.id,
        display_name: destination.display_name,
        postal_code: null,
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
        name="destination_id"
        placeholder="Ziel suchen…"
        emptyMessage="Kein Ziel gefunden"
        aria-label="Ziel auswählen"
        onCreateNew={onCreateNew ? () => setDialogOpen(true) : undefined}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      {onCreateNew && (
        <DestinationInlineDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onDestinationCreated={handleCreated}
        />
      )}
    </div>
  )
}
