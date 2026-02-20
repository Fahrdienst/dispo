"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { MoreHorizontal } from "lucide-react"
import { Input } from "@/components/ui/input"
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
import { toggleZoneActive } from "@/actions/zones"
import type { Tables } from "@/lib/types/database"

interface ZoneWithPostalCodes extends Tables<"zones"> {
  zone_postal_codes: Tables<"zone_postal_codes">[]
}

interface ZonesTableProps {
  zones: ZoneWithPostalCodes[]
}

export function ZonesTable({ zones }: ZonesTableProps) {
  const [search, setSearch] = useState("")
  const [isPending, startTransition] = useTransition()

  const filtered = zones.filter((z) => {
    const term = search.toLowerCase()
    if (!term) return true
    return (
      z.name.toLowerCase().includes(term) ||
      (z.description ?? "").toLowerCase().includes(term) ||
      z.zone_postal_codes.some((pc) => pc.postal_code.includes(term))
    )
  })

  function handleToggle(id: string, currentActive: boolean) {
    startTransition(async () => {
      await toggleZoneActive(id, !currentActive)
    })
  }

  return (
    <div className="space-y-4">
      <Input
        placeholder="Suchen (Name, PLZ)..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {filtered.length === 0 ? (
        <EmptyState message="Keine Zonen gefunden." createHref="/settings/zones/new" createLabel="Zone erfassen" />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Beschreibung</TableHead>
                <TableHead>PLZ</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((zone) => (
                <TableRow
                  key={zone.id}
                  className={!zone.is_active ? "opacity-50" : undefined}
                >
                  <TableCell className="font-medium">{zone.name}</TableCell>
                  <TableCell>
                    {zone.description
                      ? zone.description.length > 60
                        ? `${zone.description.slice(0, 60)}...`
                        : zone.description
                      : "\u2013"}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {zone.zone_postal_codes.length === 0
                        ? "\u2013"
                        : zone.zone_postal_codes
                            .map((pc) => pc.postal_code)
                            .sort()
                            .join(", ")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <ActiveBadge isActive={zone.is_active} />
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
                          <Link href={`/settings/zones/${zone.id}/edit`}>
                            Bearbeiten
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            handleToggle(zone.id, zone.is_active)
                          }
                        >
                          {zone.is_active ? "Deaktivieren" : "Aktivieren"}
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
