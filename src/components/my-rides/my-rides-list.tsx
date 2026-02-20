"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
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
            className={`border-l-4 ${RIDE_STATUS_BORDER_COLORS[ride.status]}`}
          >
            <CardContent className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                {/* Left: ride info */}
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-semibold tabular-nums">
                      {ride.pickup_time.slice(0, 5)}
                    </span>
                    <RideStatusBadge status={ride.status} />
                  </div>
                  <p className="text-sm font-medium">
                    {ride.patient_last_name}, {ride.patient_first_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {ride.destination_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {RIDE_DIRECTION_LABELS[ride.direction]}
                  </p>
                  {ride.notes && (
                    <p className="text-xs text-muted-foreground italic">
                      {ride.notes}
                    </p>
                  )}
                </div>

                {/* Right: action buttons */}
                {transitions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {transitions.map((targetStatus) => {
                      const isDestructive =
                        targetStatus === "no_show" || targetStatus === "rejected"
                      return (
                        <Button
                          key={targetStatus}
                          size="sm"
                          variant={isDestructive ? "outline" : "default"}
                          disabled={isPending}
                          onClick={() =>
                            handleStatusChange(ride.id, targetStatus)
                          }
                        >
                          {TRANSITION_BUTTON_LABELS[targetStatus] ??
                            RIDE_STATUS_LABELS[targetStatus]}
                        </Button>
                      )
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
