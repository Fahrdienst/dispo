"use client"

import { useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { RideStatusBadge } from "@/components/shared/ride-status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { updateRideStatus } from "@/actions/rides"
import { getValidTransitionsForRole } from "@/lib/rides/status-machine"
import {
  RIDE_STATUS_LABELS,
  RIDE_DIRECTION_LABELS,
  RIDE_STATUS_BORDER_COLORS,
} from "@/lib/rides/constants"
import type { Enums } from "@/lib/types/database"

/** German labels for driver status transition buttons */
const TRANSITION_BUTTON_LABELS: Partial<Record<Enums<"ride_status">, string>> = {
  rejected: "Ablehnen",
  in_progress: "Fahrt starten",
  picked_up: "Patient abgeholt",
  arrived: "Angekommen",
  completed: "Abgeschlossen",
  no_show: "Nicht erschienen",
}

interface MyRide {
  id: string
  pickup_time: string
  date: string
  status: Enums<"ride_status">
  direction: Enums<"ride_direction">
  notes: string | null
  patient_first_name: string
  patient_last_name: string
  destination_name: string
}

interface MyRidesListProps {
  rides: MyRide[]
}

export function MyRidesList({ rides }: MyRidesListProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleStatusChange(rideId: string, newStatus: Enums<"ride_status">) {
    startTransition(async () => {
      const result = await updateRideStatus(rideId, newStatus)
      if (result.success) {
        router.refresh()
      }
    })
  }

  if (rides.length === 0) {
    return <EmptyState message="Keine Fahrten fuer diesen Tag." />
  }

  return (
    <div className="space-y-4">
      {rides.map((ride) => {
        const transitions = getValidTransitionsForRole(ride.status, "driver")

        return (
          <Card
            key={ride.id}
            className={cn(
              "border-l-[5px]",
              RIDE_STATUS_BORDER_COLORS[ride.status]
            )}
          >
            <CardContent className="p-4">
              {/* Time + Status Badge */}
              <div className="flex items-start justify-between">
                <span className="text-3xl font-bold tabular-nums">
                  {ride.pickup_time.slice(0, 5)}
                </span>
                <RideStatusBadge status={ride.status} />
              </div>

              {/* Ride info */}
              <div className="mt-2 space-y-1">
                <p className="text-sm font-medium">
                  {ride.patient_last_name}, {ride.patient_first_name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {ride.destination_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {RIDE_DIRECTION_LABELS[ride.direction]}
                </p>
              </div>

              {/* Notes */}
              {ride.notes && (
                <div className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                  {ride.notes}
                </div>
              )}

              {/* Details link */}
              <Button
                variant="link"
                size="sm"
                className="mt-1 h-auto p-0 text-xs"
                asChild
              >
                <Link href={`/rides/${ride.id}`}>Details anzeigen</Link>
              </Button>

              {/* Action buttons */}
              {transitions.length > 0 && (
                <div className="mt-4 flex flex-col gap-2">
                  {transitions.map((targetStatus) => {
                    const isDestructive =
                      targetStatus === "no_show" || targetStatus === "rejected"
                    return (
                      <Button
                        key={targetStatus}
                        size="lg"
                        variant={isDestructive ? "outline" : "default"}
                        disabled={isPending}
                        onClick={() =>
                          handleStatusChange(ride.id, targetStatus)
                        }
                        className={cn(
                          "h-12 w-full text-base font-semibold",
                          isDestructive &&
                            "border-red-300 text-red-700 hover:bg-red-50"
                        )}
                      >
                        {TRANSITION_BUTTON_LABELS[targetStatus] ??
                          RIDE_STATUS_LABELS[targetStatus]}
                      </Button>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
