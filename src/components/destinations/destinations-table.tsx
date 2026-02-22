"use client"

import { useState, useTransition } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmptyState } from "@/components/shared/empty-state"
import { DestinationCard } from "@/components/destinations/destination-card"
import { DestinationDetailSheet } from "@/components/destinations/destination-detail-sheet"
import { toggleDestinationActive } from "@/actions/destinations"
import type { Tables } from "@/lib/types/database"

interface DestinationsTableProps {
  destinations: Tables<"destinations">[]
}

export function DestinationsTable({ destinations }: DestinationsTableProps) {
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [showInactive, setShowInactive] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [selected, setSelected] = useState<Tables<"destinations"> | null>(null)

  const filtered = destinations.filter((d) => {
    if (!showInactive && !d.is_active) return false
    if (typeFilter !== "all" && d.facility_type !== typeFilter) return false
    const term = search.toLowerCase()
    if (!term) return true
    return (
      d.display_name.toLowerCase().includes(term) ||
      (d.city ?? "").toLowerCase().includes(term) ||
      (d.department ?? "").toLowerCase().includes(term) ||
      (d.contact_last_name ?? "").toLowerCase().includes(term) ||
      (d.contact_phone ?? "").toLowerCase().includes(term)
    )
  })

  function handleToggle(id: string, currentActive: boolean) {
    startTransition(async () => {
      await toggleDestinationActive(id, !currentActive)
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Input
            placeholder="Suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Typen</SelectItem>
              <SelectItem value="practice">Praxis</SelectItem>
              <SelectItem value="hospital">Spital</SelectItem>
              <SelectItem value="therapy_center">Therapiezentrum</SelectItem>
              <SelectItem value="day_care">Tagesheim</SelectItem>
              <SelectItem value="other">Sonstiges</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
        <EmptyState message="Keine Ziele gefunden." createHref="/destinations/new" createLabel="Ziel erfassen" />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((dest) => (
            <DestinationCard
              key={dest.id}
              destination={dest}
              onClick={() => setSelected(dest)}
            />
          ))}
        </div>
      )}

      <DestinationDetailSheet
        destination={selected}
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
