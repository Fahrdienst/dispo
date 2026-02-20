"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
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
import { toggleDriverActive } from "@/actions/drivers"
import type { Tables } from "@/lib/types/database"

const vehicleTypeLabels: Record<string, string> = {
  standard: "Standard",
  wheelchair: "Rollstuhl",
  stretcher: "Trage",
}

interface DriversTableProps {
  drivers: Tables<"drivers">[]
}

export function DriversTable({ drivers }: DriversTableProps) {
  const [search, setSearch] = useState("")
  const [showInactive, setShowInactive] = useState(false)
  const [isPending, startTransition] = useTransition()

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
        <EmptyState message="Keine Fahrer gefunden." createHref="/drivers/new" createLabel="Fahrer erfassen" />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Ort</TableHead>
                <TableHead>Fahrzeugtyp</TableHead>
                <TableHead>Fahrzeug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((driver) => (
                <TableRow
                  key={driver.id}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-muted/60",
                    !driver.is_active && "opacity-50"
                  )}
                >
                  <TableCell className="font-medium">
                    {driver.last_name}, {driver.first_name}
                  </TableCell>
                  <TableCell>{driver.phone ?? "\u2013"}</TableCell>
                  <TableCell>{driver.city ?? "\u2013"}</TableCell>
                  <TableCell>
                    {vehicleTypeLabels[driver.vehicle_type] ?? driver.vehicle_type}
                  </TableCell>
                  <TableCell>{driver.vehicle ?? "\u2013"}</TableCell>
                  <TableCell>
                    <ActiveBadge isActive={driver.is_active} />
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
                          <Link href={`/drivers/${driver.id}/edit`}>
                            Bearbeiten
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/drivers/${driver.id}/availability`}>
                            Verfuegbarkeit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            handleToggle(driver.id, driver.is_active)
                          }
                        >
                          {driver.is_active ? "Deaktivieren" : "Aktivieren"}
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
