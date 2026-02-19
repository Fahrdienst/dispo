"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { RideStatusBadge } from "@/components/shared/ride-status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { toggleRideActive, updateRideStatus } from "@/actions/rides"
import { getValidTransitions } from "@/lib/rides/status-machine"
import {
  RIDE_STATUS_LABELS,
  RIDE_DIRECTION_LABELS,
} from "@/lib/rides/constants"
import type { Tables, Enums } from "@/lib/types/database"

type RideWithRelations = Tables<"rides"> & {
  patients: Pick<Tables<"patients">, "id" | "first_name" | "last_name">
  destinations: Pick<Tables<"destinations">, "id" | "name">
  drivers: Pick<Tables<"drivers">, "id" | "first_name" | "last_name"> | null
}

interface RidesTableProps {
  rides: RideWithRelations[]
}

const ALL_STATUSES: Enums<"ride_status">[] = [
  "unplanned",
  "planned",
  "confirmed",
  "rejected",
  "in_progress",
  "picked_up",
  "arrived",
  "completed",
  "cancelled",
  "no_show",
]

export function RidesTable({ rides }: RidesTableProps) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [isPending, startTransition] = useTransition()

  const filtered = rides.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false
    const term = search.toLowerCase()
    if (!term) return true
    const patientName = `${r.patients.last_name} ${r.patients.first_name}`.toLowerCase()
    const destinationName = r.destinations.name.toLowerCase()
    const driverName = r.drivers
      ? `${r.drivers.last_name} ${r.drivers.first_name}`.toLowerCase()
      : ""
    return (
      patientName.includes(term) ||
      destinationName.includes(term) ||
      driverName.includes(term)
    )
  })

  function handleStatusChange(rideId: string, newStatus: Enums<"ride_status">) {
    startTransition(async () => {
      await updateRideStatus(rideId, newStatus)
    })
  }

  function handleToggle(id: string, currentActive: boolean) {
    startTransition(async () => {
      await toggleRideActive(id, !currentActive)
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Input
          placeholder="Suchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {RIDE_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="Keine Fahrten gefunden." />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Uhrzeit</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Ziel</TableHead>
                <TableHead>Fahrer</TableHead>
                <TableHead>Richtung</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((ride) => {
                const transitions = getValidTransitions(ride.status)
                return (
                  <TableRow
                    key={ride.id}
                    className={!ride.is_active ? "opacity-50" : undefined}
                  >
                    <TableCell>{ride.pickup_time.slice(0, 5)}</TableCell>
                    <TableCell className="font-medium">
                      {ride.patients.last_name}, {ride.patients.first_name}
                    </TableCell>
                    <TableCell>{ride.destinations.name}</TableCell>
                    <TableCell>
                      {ride.drivers
                        ? `${ride.drivers.last_name}, ${ride.drivers.first_name}`
                        : "–"}
                    </TableCell>
                    <TableCell>
                      {RIDE_DIRECTION_LABELS[ride.direction]}
                    </TableCell>
                    <TableCell>
                      <RideStatusBadge status={ride.status} />
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isPending}
                          >
                            ...
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/rides/${ride.id}/edit`}>
                              Bearbeiten
                            </Link>
                          </DropdownMenuItem>
                          {transitions.length > 0 && (
                            <>
                              <DropdownMenuSeparator />
                              {transitions.map((t) => (
                                <DropdownMenuItem
                                  key={t}
                                  onClick={() =>
                                    handleStatusChange(ride.id, t)
                                  }
                                >
                                  {RIDE_STATUS_LABELS[t]}
                                </DropdownMenuItem>
                              ))}
                            </>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() =>
                              handleToggle(ride.id, ride.is_active)
                            }
                          >
                            {ride.is_active ? "Deaktivieren" : "Aktivieren"}
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
