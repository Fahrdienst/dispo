"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { ActiveBadge } from "@/components/shared/active-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { toggleRideSeriesActive } from "@/actions/ride-series"
import { RIDE_DIRECTION_LABELS } from "@/lib/rides/constants"
import {
  RECURRENCE_TYPE_LABELS,
  DAY_OF_WEEK_LABELS,
} from "@/lib/ride-series/constants"
import { GenerateRidesDialog } from "@/components/ride-series/generate-rides-dialog"
import type { Tables, Enums } from "@/lib/types/database"

type RideSeriesWithRelations = Tables<"ride_series"> & {
  patients: Pick<Tables<"patients">, "id" | "first_name" | "last_name">
  destinations: Pick<Tables<"destinations">, "id" | "display_name">
}

interface RideSeriesTableProps {
  seriesList: RideSeriesWithRelations[]
}

export function RideSeriesTable({ seriesList }: RideSeriesTableProps) {
  const [search, setSearch] = useState("")
  const [isPending, startTransition] = useTransition()
  const [generateSeriesId, setGenerateSeriesId] = useState<string | null>(null)

  const filtered = seriesList.filter((s) => {
    const term = search.toLowerCase()
    if (!term) return true
    const patientName =
      `${s.patients.last_name} ${s.patients.first_name}`.toLowerCase()
    const destinationName = s.destinations.display_name.toLowerCase()
    return patientName.includes(term) || destinationName.includes(term)
  })

  function handleToggle(id: string, currentActive: boolean) {
    startTransition(async () => {
      await toggleRideSeriesActive(id, !currentActive)
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
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="Keine Fahrtserien gefunden." createHref="/ride-series/new" createLabel="Fahrtserie erfassen" />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Ziel</TableHead>
                <TableHead>Abholzeit</TableHead>
                <TableHead>Wiederholung</TableHead>
                <TableHead>Wochentage</TableHead>
                <TableHead>Richtung</TableHead>
                <TableHead>Zeitraum</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((series) => (
                <TableRow
                  key={series.id}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-muted/60",
                    !series.is_active && "opacity-50"
                  )}
                >
                  <TableCell className="font-medium">
                    {series.patients.last_name}, {series.patients.first_name}
                  </TableCell>
                  <TableCell>{series.destinations.display_name}</TableCell>
                  <TableCell>{series.pickup_time.slice(0, 5)}</TableCell>
                  <TableCell>
                    {RECURRENCE_TYPE_LABELS[series.recurrence_type]}
                  </TableCell>
                  <TableCell>
                    {series.days_of_week && series.days_of_week.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {series.days_of_week.map((day) => (
                          <span
                            key={day}
                            className="inline-flex items-center rounded-md bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-800"
                          >
                            {DAY_OF_WEEK_LABELS[day]}
                          </span>
                        ))}
                      </div>
                    ) : (
                      "–"
                    )}
                  </TableCell>
                  <TableCell>
                    {RIDE_DIRECTION_LABELS[series.direction]}
                  </TableCell>
                  <TableCell className="text-sm">
                    {series.start_date}
                    {series.end_date ? ` – ${series.end_date}` : " – offen"}
                  </TableCell>
                  <TableCell>
                    <ActiveBadge isActive={series.is_active} />
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
                          <Link href={`/ride-series/${series.id}/edit`}>
                            Bearbeiten
                          </Link>
                        </DropdownMenuItem>
                        {series.is_active && (
                          <DropdownMenuItem
                            onClick={() => setGenerateSeriesId(series.id)}
                          >
                            Fahrten generieren
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() =>
                            handleToggle(series.id, series.is_active)
                          }
                        >
                          {series.is_active ? "Deaktivieren" : "Aktivieren"}
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

      <GenerateRidesDialog
        seriesId={generateSeriesId}
        open={generateSeriesId !== null}
        onOpenChange={(open) => {
          if (!open) setGenerateSeriesId(null)
        }}
      />
    </div>
  )
}
