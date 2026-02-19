"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
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

const destinationTypeLabels: Record<string, string> = {
  hospital: "Krankenhaus",
  doctor: "Arzt",
  therapy: "Therapie",
  other: "Sonstiges",
}

interface DestinationsTableProps {
  destinations: Tables<"destinations">[]
}

export function DestinationsTable({ destinations }: DestinationsTableProps) {
  const [search, setSearch] = useState("")
  const [showInactive, setShowInactive] = useState(false)
  const [isPending, startTransition] = useTransition()

  const filtered = destinations.filter((d) => {
    if (!showInactive && !d.is_active) return false
    const term = search.toLowerCase()
    if (!term) return true
    return (
      d.name.toLowerCase().includes(term) ||
      (d.city ?? "").toLowerCase().includes(term) ||
      (d.department ?? "").toLowerCase().includes(term)
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
        <EmptyState message="Keine Ziele gefunden." />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Abteilung</TableHead>
                <TableHead>Stadt</TableHead>
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
                  <TableCell className="font-medium">{dest.name}</TableCell>
                  <TableCell>
                    {destinationTypeLabels[dest.type] ?? dest.type}
                  </TableCell>
                  <TableCell>{dest.department ?? "–"}</TableCell>
                  <TableCell>{dest.city ?? "–"}</TableCell>
                  <TableCell>
                    <ActiveBadge isActive={dest.is_active} />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" disabled={isPending}>
                          ...
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
