import Link from "next/link"
import { Check } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { RideStatusBadge } from "@/components/shared/ride-status-badge"
import { cn } from "@/lib/utils"
import { RIDE_DIRECTION_LABELS } from "@/lib/rides/constants"
import {
  formatChf,
  formatDateShort,
  type PatientRideRow,
} from "@/lib/patients/rides-receipts"

interface PatientRidesListProps {
  rows: PatientRideRow[]
}

/**
 * Table of a patient's rides for the selected period.
 * Columns: Datum, Ziel, Richtung, Status, km, Preis + a "quittiert" marker.
 * Receipted rides get a subtle green tint; rides without a price are flagged red.
 */
export function PatientRidesList({ rows }: PatientRidesListProps) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
        Keine Fahrten im gewählten Zeitraum.
      </p>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Datum</TableHead>
            <TableHead>Ziel</TableHead>
            <TableHead>Richtung</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">km</TableHead>
            <TableHead className="text-right">Preis</TableHead>
            <TableHead>Quittung</TableHead>
            <TableHead className="w-[60px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.id}
              className={cn(row.isReceipted && "bg-green-50/50")}
            >
              <TableCell className="whitespace-nowrap">
                {formatDateShort(row.date)}
                <span className="ml-1 text-xs text-muted-foreground">
                  {row.pickupTime}
                </span>
              </TableCell>
              <TableCell>{row.destinationName}</TableCell>
              <TableCell className="whitespace-nowrap">
                {RIDE_DIRECTION_LABELS[row.direction]}
              </TableCell>
              <TableCell>
                <RideStatusBadge status={row.status} />
              </TableCell>
              <TableCell className="whitespace-nowrap text-right">
                {row.distanceKm !== null ? `${row.distanceKm}` : "–"}
              </TableCell>
              <TableCell
                className={cn(
                  "whitespace-nowrap text-right",
                  row.hasPrice
                    ? "text-green-700"
                    : "font-medium text-red-600"
                )}
                title={row.hasPrice ? undefined : "Kein Preis erfasst"}
              >
                {row.price !== null ? formatChf(row.price) : "ohne Preis"}
              </TableCell>
              <TableCell>
                {row.isReceipted ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-md bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
                    title="Auf einer aktiven Quittung"
                  >
                    <Check className="h-3 w-3 shrink-0" aria-hidden="true" />
                    Quittiert
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">&ndash;</span>
                )}
              </TableCell>
              <TableCell>
                <Link
                  href={`/rides/${row.id}`}
                  className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                >
                  Details
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
