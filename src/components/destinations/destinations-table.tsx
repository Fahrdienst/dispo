"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { MoreHorizontal } from "lucide-react"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { ActiveBadge } from "@/components/shared/active-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { toggleDestinationActive } from "@/actions/destinations"
import type { Tables } from "@/lib/types/database"

const facilityTypeLabels: Record<string, string> = {
  practice: "Praxis",
  hospital: "Spital",
  therapy_center: "Therapiezentrum",
  day_care: "Tagesheim",
  other: "Sonstiges",
}

interface DestinationsTableProps {
  destinations: Tables<"destinations">[]
}

export function DestinationsTable({ destinations }: DestinationsTableProps) {
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [showInactive, setShowInactive] = useState(false)
  const [isPending, startTransition] = useTransition()

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
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Kontakt</TableHead>
                <TableHead>Ort</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((dest) => (
                <TableRow
                  key={dest.id}
                  className={!dest.is_active ? "opacity-50" : undefined}
                >
                  <TableCell className="font-medium">
                    {dest.display_name}
                  </TableCell>
                  <TableCell>
                    {facilityTypeLabels[dest.facility_type] ?? dest.facility_type}
                  </TableCell>
                  <TableCell>
                    {dest.contact_last_name
                      ? `${dest.contact_last_name}, ${dest.contact_phone ?? ""}`
                      : "\u2013"}
                  </TableCell>
                  <TableCell>{dest.city ?? "\u2013"}</TableCell>
                  <TableCell>
                    <ActiveBadge isActive={dest.is_active} />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isPending}>
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Aktionen</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/destinations/${dest.id}/edit`}>
                            Bearbeiten
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            handleToggle(dest.id, dest.is_active)
                          }
                        >
                          {dest.is_active ? "Deaktivieren" : "Aktivieren"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
