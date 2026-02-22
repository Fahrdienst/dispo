import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDayLabel } from "@/lib/utils/dates"
import { RIDE_STATUS_DOT_COLORS } from "@/lib/rides/constants"
import { Button } from "@/components/ui/button"
import type { Enums } from "@/lib/types/database"

type RideStatus = Enums<"ride_status">

interface DispatchWeekRide {
  id: string
  date: string
  pickup_time: string
  status: RideStatus
  driver_id: string | null
  driver_last_name: string | null
  patient_last_name: string
  patient_first_name: string
}

interface DispatchWeekViewProps {
  weekDates: string[]
  ridesByDate: Map<string, DispatchWeekRide[]>
  today: string
}

const MAX_PILLS = 8

export function DispatchWeekView({
  weekDates,
  ridesByDate,
  today,
}: DispatchWeekViewProps) {
  return (
    <>
      {/* Desktop: 7-column grid */}
      <div className="hidden lg:grid lg:grid-cols-7 lg:gap-2">
        {weekDates.map((dateStr) => {
          const rides = ridesByDate.get(dateStr) ?? []
          const isToday = dateStr === today
          const unassignedCount = rides.filter(
            (r) =>
              !r.driver_id &&
              r.status !== "cancelled" &&
              r.status !== "completed" &&
              r.status !== "no_show"
          ).length
          const hasUnassigned = unassignedCount > 0
          const overflow = rides.length > MAX_PILLS

          return (
            <div
              key={dateStr}
              className={cn(
                "flex flex-col rounded-lg border",
                isToday && "border-t-2 border-t-primary bg-primary/[0.02]",
                hasUnassigned &&
                  !isToday &&
                  "border-t-2 border-t-amber-500"
              )}
            >
              {/* Day Header */}
              <Link
                href={`/dispatch?date=${dateStr}`}
                className="flex flex-col items-center gap-0.5 border-b px-2 py-2 hover:bg-muted/50"
              >
                <span
                  className={cn(
                    "text-xs font-medium uppercase text-muted-foreground",
                    isToday && "text-primary"
                  )}
                >
                  {formatDayLabel(dateStr).split(" ")[0]}
                </span>
                <span
                  className={cn(
                    "text-sm font-semibold",
                    isToday && "text-primary"
                  )}
                >
                  {formatDayLabel(dateStr).split(" ").slice(1).join(" ")}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">
                    {rides.length}
                  </span>
                  {hasUnassigned && (
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                      {unassignedCount} offen
                    </span>
                  )}
                </div>
              </Link>

              {/* Ride Pills */}
              <div className="flex flex-1 flex-col gap-1 p-1.5">
                {rides.length === 0 ? (
                  <EmptyDayCell dateStr={dateStr} isPast={dateStr < today} />
                ) : (
                  <>
                    {rides.slice(0, MAX_PILLS).map((ride) => (
                      <DispatchRidePill key={ride.id} ride={ride} />
                    ))}
                    {overflow && (
                      <Link
                        href={`/dispatch?date=${dateStr}`}
                        className="mt-1 text-center text-xs text-muted-foreground hover:text-foreground"
                      >
                        + {rides.length - MAX_PILLS} weitere
                      </Link>
                    )}
                  </>
                )}
              </div>

              {/* Footer CTA */}
              {rides.length > 0 && (
                <div className="border-t p-1.5">
                  <Button
                    variant={hasUnassigned ? "default" : "ghost"}
                    size="sm"
                    className="w-full text-xs"
                    asChild
                  >
                    <Link href={`/dispatch?date=${dateStr}`}>
                      {hasUnassigned ? "Disponieren" : "Tag oeffnen"}
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Mobile: Vertical list grouped by date */}
      <div className="space-y-4 lg:hidden">
        {weekDates.map((dateStr) => {
          const rides = ridesByDate.get(dateStr) ?? []
          const isToday = dateStr === today
          const unassignedCount = rides.filter(
            (r) =>
              !r.driver_id &&
              r.status !== "cancelled" &&
              r.status !== "completed" &&
              r.status !== "no_show"
          ).length

          return (
            <div key={dateStr}>
              <Link
                href={`/dispatch?date=${dateStr}`}
                className={cn(
                  "mb-2 flex items-center gap-2 rounded-md px-2 py-1.5",
                  isToday
                    ? "bg-primary/10 font-semibold text-primary"
                    : "font-medium text-foreground hover:bg-muted/50"
                )}
              >
                <span className="text-sm">{formatDayLabel(dateStr)}</span>
                <span className="text-xs text-muted-foreground">
                  ({rides.length})
                </span>
                {unassignedCount > 0 && (
                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                    {unassignedCount} offen
                  </span>
                )}
              </Link>
              {rides.length === 0 ? (
                <p className="px-2 text-xs text-muted-foreground">
                  Keine Fahrten
                </p>
              ) : (
                <div className="space-y-1">
                  {rides.map((ride) => (
                    <DispatchRidePill key={ride.id} ride={ride} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

// --- Sub-components ---

function DispatchRidePill({ ride }: { ride: DispatchWeekRide }) {
  const patientLabel = `${ride.patient_last_name}, ${ride.patient_first_name.charAt(0)}.`

  const isUnassigned =
    !ride.driver_id &&
    ride.status !== "cancelled" &&
    ride.status !== "completed" &&
    ride.status !== "no_show"
  const isCompleted =
    ride.status === "completed" ||
    ride.status === "cancelled" ||
    ride.status === "no_show"

  return (
    <Link
      href={`/rides/${ride.id}`}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-muted hover:shadow-sm",
        isUnassigned
          ? "border border-amber-300 bg-amber-50"
          : "bg-muted/50",
        isCompleted && "opacity-50"
      )}
    >
      {isUnassigned ? (
        <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" />
      ) : (
        <span
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            RIDE_STATUS_DOT_COLORS[ride.status]
          )}
        />
      )}
      <span className="font-semibold tabular-nums">
        {ride.pickup_time.slice(0, 5)}
      </span>
      <span className="truncate">{patientLabel}</span>
      {ride.driver_last_name && (
        <span className="ml-auto truncate text-muted-foreground">
          {ride.driver_last_name}
        </span>
      )}
    </Link>
  )
}

function EmptyDayCell({
  dateStr,
  isPast,
}: {
  dateStr: string
  isPast: boolean
}) {
  return (
    <div className="flex min-h-[80px] flex-1 items-center justify-center rounded-md border border-dashed border-muted-foreground/20">
      {!isPast ? (
        <Link
          href={`/rides/new?date=${dateStr}`}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          + Fahrt erfassen
        </Link>
      ) : (
        <span className="text-xs text-muted-foreground">Keine Fahrten</span>
      )}
    </div>
  )
}
