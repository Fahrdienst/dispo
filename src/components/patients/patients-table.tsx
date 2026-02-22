"use client"

import { useState, useTransition } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { EmptyState } from "@/components/shared/empty-state"
import { PatientCard } from "@/components/patients/patient-card"
import { PatientDetailSheet } from "@/components/patients/patient-detail-sheet"
import { togglePatientActive } from "@/actions/patients"
import type { Tables } from "@/lib/types/database"

type PatientWithImpairments = Tables<"patients"> & {
  patient_impairments: Tables<"patient_impairments">[]
}

interface PatientsTableProps {
  patients: PatientWithImpairments[]
}

export function PatientsTable({ patients }: PatientsTableProps) {
  const [search, setSearch] = useState("")
  const [showInactive, setShowInactive] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [selected, setSelected] = useState<PatientWithImpairments | null>(null)

  const filtered = patients.filter((p) => {
    if (!showInactive && !p.is_active) return false
    const term = search.toLowerCase()
    if (!term) return true
    return (
      p.first_name.toLowerCase().includes(term) ||
      p.last_name.toLowerCase().includes(term) ||
      (p.city ?? "").toLowerCase().includes(term) ||
      (p.postal_code ?? "").toLowerCase().includes(term) ||
      (p.phone ?? "").toLowerCase().includes(term)
    )
  })

  function handleToggle(id: string, currentActive: boolean) {
    startTransition(async () => {
      await togglePatientActive(id, !currentActive)
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Suchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex items-center gap-2">
          <Checkbox
            id="show-inactive"
            checked={showInactive}
            onCheckedChange={(checked) => setShowInactive(checked === true)}
          />
          <Label htmlFor="show-inactive" className="text-sm font-normal">
            Inaktive anzeigen
          </Label>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="Keine Patienten gefunden." createHref="/patients/new" createLabel="Patient erfassen" />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((patient) => (
            <PatientCard
              key={patient.id}
              patient={patient}
              onClick={() => setSelected(patient)}
            />
          ))}
        </div>
      )}

      <PatientDetailSheet
        patient={selected}
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
        onToggleActive={handleToggle}
        isPending={isPending}
      />
    </div>
  )
}
