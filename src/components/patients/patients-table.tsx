"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
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
import { togglePatientActive } from "@/actions/patients"
import type { Tables } from "@/lib/types/database"

interface PatientsTableProps {
  patients: Tables<"patients">[]
}

export function PatientsTable({ patients }: PatientsTableProps) {
  const [search, setSearch] = useState("")
  const [showInactive, setShowInactive] = useState(false)
  const [isPending, startTransition] = useTransition()

  const filtered = patients.filter((p) => {
    if (!showInactive && !p.is_active) return false
    const term = search.toLowerCase()
    if (!term) return true
    return (
      p.first_name.toLowerCase().includes(term) ||
      p.last_name.toLowerCase().includes(term) ||
      (p.city ?? "").toLowerCase().includes(term) ||
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
        <EmptyState message="Keine Patienten gefunden." />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Stadt</TableHead>
                <TableHead>Anforderungen</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((patient) => (
                <TableRow
                  key={patient.id}
                  className={!patient.is_active ? "opacity-50" : undefined}
                >
                  <TableCell className="font-medium">
                    {patient.last_name}, {patient.first_name}
                  </TableCell>
                  <TableCell>{patient.phone ?? "–"}</TableCell>
                  <TableCell>{patient.city ?? "–"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {patient.needs_wheelchair && (
                        <Badge variant="outline">Rollstuhl</Badge>
                      )}
                      {patient.needs_stretcher && (
                        <Badge variant="outline">Trage</Badge>
                      )}
                      {patient.needs_companion && (
                        <Badge variant="outline">Begleitperson</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <ActiveBadge isActive={patient.is_active} />
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
                          <Link href={`/patients/${patient.id}/edit`}>
                            Bearbeiten
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            handleToggle(patient.id, patient.is_active)
                          }
                        >
                          {patient.is_active ? "Deaktivieren" : "Aktivieren"}
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
