"use client"

import { useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Navigation } from "lucide-react"
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
  RIDE_STATUS_DOT_COLORS,
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

/** Steps shown in the driver progress indicator (in order). */
const DRIVER_PROGRESS_STEPS = [
  { status: "planned", label: "Geplant" },
  { status: "confirmed", label: "Bestätigt" },
  { status: "in_progress", label: "Unterwegs" },
  { status: "picked_up", label: "Abgeholt" },
  { status: "arrived", label: "Angekommen" },
  { status: "completed", label: "Abgeschlossen" },
] as const

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
  destination_address: string | null
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

              {/* Progress indicator */}
              <RideProgressBar status={ride.status} />

              {/* Google Maps navigation link */}
              {ride.destination_address && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(ride.destination_address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex h-11 items-center justify-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-4 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                >
                  <Navigation className="h-4 w-4" />
                  Navigation starten
                </a>
              )}

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

// ---------------------------------------------------------------------------
// Progress bar sub-component
// ---------------------------------------------------------------------------

interface RideProgressBarProps {
  status: Enums<"ride_status">
}

/** Determine the index of the current status within the progress steps. Returns -1 for non-progress statuses. */
function getProgressIndex(status: Enums<"ride_status">): number {
  return DRIVER_PROGRESS_STEPS.findIndex((s) => s.status === status)
}

function RideProgressBar({ status }: RideProgressBarProps) {
  const currentIndex = getProgressIndex(status)

  // Don't show progress for statuses outside the normal flow (cancelled, rejected, no_show, unplanned)
  if (currentIndex < 0) return null

  return (
    <div className="mt-3">
      {/* Dots + connecting line */}
      <div className="flex items-center justify-between">
        {DRIVER_PROGRESS_STEPS.map((step, i) => {
          const isCompleted = i < currentIndex
          const isCurrent = i === currentIndex
          const dotColor = isCompleted || isCurrent
            ? RIDE_STATUS_DOT_COLORS[step.status]
            : "bg-gray-200"

          return (
            <div key={step.status} className="flex flex-1 items-center">
              {/* Dot */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "h-3 w-3 rounded-full border-2 transition-colors",
                    isCurrent && "ring-2 ring-offset-1",
                    isCurrent ? `ring-current ${dotColor} border-transparent` : "",
                    isCompleted ? `${dotColor} border-transparent` : "",
                    !isCompleted && !isCurrent ? "border-gray-300 bg-white" : ""
                  )}
                />
              </div>
              {/* Connecting line (not after last dot) */}
              {i < DRIVER_PROGRESS_STEPS.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 flex-1",
                    i < currentIndex ? "bg-green-400" : "bg-gray-200"
                  )}
                />
              )}
            </div>
          )
        })}
      </div>
      {/* Labels */}
      <div className="mt-1 flex justify-between">
        {DRIVER_PROGRESS_STEPS.map((step, i) => {
          const isCurrent = i === currentIndex
          return (
            <span
              key={step.status}
              className={cn(
                "text-center text-[10px] leading-tight",
                isCurrent
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground"
              )}
              style={{ width: `${100 / DRIVER_PROGRESS_STEPS.length}%` }}
            >
              {step.label}
            </span>
          )
        })}
      </div>
    </div>
  )
}
