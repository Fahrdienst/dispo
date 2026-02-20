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
import { toggleFareVersionActive } from "@/actions/fares"
import type { Tables } from "@/lib/types/database"

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

interface FareVersionWithRuleCount extends Tables<"fare_versions"> {
  fare_rules: { count: number }[]
}

interface FareVersionsTableProps {
  fareVersions: FareVersionWithRuleCount[]
}

export function FareVersionsTable({ fareVersions }: FareVersionsTableProps) {
  const [search, setSearch] = useState("")
  const [isPending, startTransition] = useTransition()

  const filtered = fareVersions.filter((fv) => {
    const term = search.toLowerCase()
    if (!term) return true
    return fv.name.toLowerCase().includes(term)
  })

  function handleToggle(id: string, currentActive: boolean) {
    startTransition(async () => {
      await toggleFareVersionActive(id, !currentActive)
    })
  }

  return (
    <div className="space-y-4">
      <Input
        placeholder="Suchen..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {filtered.length === 0 ? (
        <EmptyState message="Keine Tarifversionen gefunden." createHref="/settings/fares/new" createLabel="Tarifversion erfassen" />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Gueltig ab</TableHead>
                <TableHead>Gueltig bis</TableHead>
                <TableHead>Regeln</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((fv) => {
                const ruleCount = fv.fare_rules[0]?.count ?? 0
                return (
                  <TableRow
                    key={fv.id}
                    className={!fv.is_active ? "opacity-50" : undefined}
                  >
                    <TableCell className="font-medium">{fv.name}</TableCell>
                    <TableCell>{formatDate(fv.valid_from)}</TableCell>
                    <TableCell>
                      {fv.valid_to ? formatDate(fv.valid_to) : "unbegrenzt"}
                    </TableCell>
                    <TableCell>{ruleCount}</TableCell>
                    <TableCell>
                      <ActiveBadge isActive={fv.is_active} />
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={isPending}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Aktionen</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/settings/fares/${fv.id}/edit`}>
                              Bearbeiten
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              handleToggle(fv.id, fv.is_active)
                            }
                          >
                            {fv.is_active ? "Deaktivieren" : "Aktivieren"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
