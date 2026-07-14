"use client"

// SLOT (#135): Bedarfs-Chips (Rollstuhl, Rollator, Begleitung, Sauerstoff, …).
// Functional stub: renders a labeled placeholder and mirrors the current value
// into hidden `requirements` inputs so form submission already carries them.
// Issue #135 builds the toggleable chip UI (multi-select) on top of the same
// props contract — the core owns the `value`/`onChange` state.

import { Tag } from "lucide-react"
import type { RideRequirement } from "@/lib/rides/requirements"

export interface RequirementChipsProps {
  /** Currently selected requirements. */
  value: RideRequirement[]
  /** Toggle handler (replaces the whole set). */
  onChange: (value: RideRequirement[]) => void
}

export function RequirementChips({ value }: RequirementChipsProps) {
  return (
    <div className="space-y-1.5">
      {/* Hidden inputs so the current selection is submitted with the form.
          `requirements` is a multi-value field parsed via formData.getAll(). */}
      {value.map((req) => (
        <input key={req} type="hidden" name="requirements" value={req} />
      ))}
      <div className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
        <Tag className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>Bedarfs-Chips folgen (#135)</span>
      </div>
    </div>
  )
}
