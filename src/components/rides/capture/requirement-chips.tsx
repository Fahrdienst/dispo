"use client"

// SLOT (#135): Bedarfs-Chips für die Fahrt-Erfassung.
//
// Tap-/klickbare Toggle-Chips für alle `RIDE_REQUIREMENTS` (Rollstuhl, Rollator,
// Begleitung, Sauerstoff, Tragestuhl, Liegend). Der Kern besitzt den State und
// gibt `value`/`onChange` herein — dieser Slot rendert nur die UI und spiegelt
// die aktuelle Auswahl in versteckte Formularfelder:
//   - `requirements` (multi-value, via formData.getAll) → rides.requirements (#126)
//   - `has_escort` = "true", sobald "Begleitung" gewählt ist. Der Server koppelt
//     das ohnehin über `resolveHasEscort(has_escort, requirements)`; wir setzen
//     das Feld hier zusätzlich explizit, damit die Konsistenz auch auf
//     FormData-Ebene garantiert ist (AC #135).
//
// Zusätzlich wird der daraus abgeleitete Fahrzeugtyp (`requirementsToVehicleType`,
// #126) rein informativ angezeigt — es findet KEIN Fahrer-/Fahrzeug-Assignment
// statt (out of scope M13).
//
// TODO (#135, optional): Vorbelegung als entfernbarer Vorschlag aus
// `patient_impairments` des gewählten Patienten. Das ist mit dem aktuellen
// Props-Contract NICHT möglich — `RequirementChips` erhält weder den Patienten
// noch dessen Impairments. Dafür müsste der Kern (`ride-capture-form.tsx`) die
// Impairments des gewählten Patienten laden/durchreichen (baut auf #126 auf).

import { Car, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  RIDE_REQUIREMENTS,
  requirementsToVehicleType,
  type RideRequirement,
} from "@/lib/rides/requirements"
import { RIDE_REQUIREMENT_LABELS, VEHICLE_TYPE_LABELS } from "@/lib/rides/constants"

export interface RequirementChipsProps {
  /** Currently selected requirements. */
  value: RideRequirement[]
  /** Toggle handler (replaces the whole set). */
  onChange: (value: RideRequirement[]) => void
}

export function RequirementChips({ value, onChange }: RequirementChipsProps) {
  const toggle = (req: RideRequirement): void => {
    onChange(
      value.includes(req)
        ? value.filter((r) => r !== req)
        : [...value, req]
    )
  }

  const vehicleType = requirementsToVehicleType(value)
  const hasCompanion = value.includes("companion")

  return (
    <div className="space-y-2.5">
      {/* Hidden inputs so the current selection is submitted with the form.
          `requirements` is a multi-value field parsed via formData.getAll(). */}
      {value.map((req) => (
        <input key={req} type="hidden" name="requirements" value={req} />
      ))}
      {/* Keep `has_escort` consistent with the "Begleitung" chip (tariff-relevant,
          AC #135). The server additionally derives this from `requirements`. */}
      {hasCompanion && <input type="hidden" name="has_escort" value="true" />}

      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Bedarf für die Fahrt"
      >
        {RIDE_REQUIREMENTS.map((req) => {
          const selected = value.includes(req)
          return (
            <button
              key={req}
              type="button"
              onClick={() => toggle(req)}
              aria-pressed={selected}
              className={cn(
                // Large tap target for touch / 60+ usability.
                "inline-flex min-h-[2.5rem] items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-ring/40 focus:ring-offset-1",
                selected
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-input bg-white text-muted-foreground hover:bg-muted/50"
              )}
            >
              <Check
                className={cn(
                  "h-3.5 w-3.5 shrink-0 transition-opacity",
                  selected ? "opacity-100" : "opacity-0"
                )}
                aria-hidden="true"
              />
              {RIDE_REQUIREMENT_LABELS[req]}
            </button>
          )
        })}
      </div>

      {/* Derived vehicle type — informative only (#126). No assignment happens. */}
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Car className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Benötigtes Fahrzeug:{" "}
        <span className="font-medium text-foreground">
          {VEHICLE_TYPE_LABELS[vehicleType]}
        </span>
      </p>
    </div>
  )
}
