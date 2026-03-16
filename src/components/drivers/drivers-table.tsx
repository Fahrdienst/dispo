"use client"

import { useState, useTransition } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { EmptyState } from "@/components/shared/empty-state"
import { DriverCard } from "@/components/drivers/driver-card"
import { DriverDetailSheet } from "@/components/drivers/driver-detail-sheet"
import { toggleDriverActive } from "@/actions/drivers"
import type { Tables, Enums } from "@/lib/types/database"

interface DriversTableProps {
  drivers: Tables<"drivers">[]
  userRole?: Enums<"user_role">
}

export function DriversTable({ drivers, userRole }: DriversTableProps) {
  const [search, setSearch] = useState("")
  const [showInactive, setShowInactive] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [selected, setSelected] = useState<Tables<"drivers"> | null>(null)

  const filtered = drivers.filter((d) => {
    if (!showInactive && !d.is_active) return false
    const term = search.toLowerCase()
    if (!term) return true
    return (
      d.first_name.toLowerCase().includes(term) ||
      d.last_name.toLowerCase().includes(term) ||
      (d.phone ?? "").toLowerCase().includes(term) ||
      (d.city ?? "").toLowerCase().includes(term) ||
      (d.vehicle ?? "").toLowerCase().includes(term)
    )
  })

  function handleToggle(id: string, currentActive: boolean) {
    startTransition(async () => {
      await toggleDriverActive(id, !currentActive)
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
        <EmptyState
          message="Keine Fahrer gefunden."
          createHref="/drivers/new"
          createLabel="Fahrer erfassen"
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((driver) => (
            <DriverCard
              key={driver.id}
              driver={driver}
              onClick={() => setSelected(driver)}
            />
          ))}
        </div>
      )}

      <DriverDetailSheet
        driver={selected}
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
        onToggleActive={handleToggle}
        isPending={isPending}
        userRole={userRole}
      />
    </div>
  )
}
