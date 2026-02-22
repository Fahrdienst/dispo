import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDayLabel } from "@/lib/utils/dates"
import { RIDE_STATUS_DOT_COLORS } from "@/lib/rides/constants"
import type { Enums } from "@/lib/types/database"

type RideStatus = Enums<"ride_status">

interface WeekRide {
  id: string
  date: string
  pickup_time: string
  status: RideStatus
  patients: { first_name: string; last_name: string } | null
}

interface RidesWeekViewProps {
  weekDates: string[]
  ridesByDate: Map<string, WeekRide[]>
  today: string
  isStaff: boolean
}

const MAX_PILLS = 8

export function RidesWeekView({
  weekDates,
  ridesByDate,
  today,
  isStaff,
}: RidesWeekViewProps) {
  return (
    <>
      {/* Desktop: 7-column grid */}
      <div className="hidden lg:grid lg:grid-cols-7 lg:gap-2">
        {weekDates.map((dateStr) => {
          const rides = ridesByDate.get(dateStr) ?? []
          const isToday = dateStr === today
          const hasAlert = rides.some(
            (r) => r.status === "unplanned" || r.status === "rejected"
          )
          const overflow = rides.length > MAX_PILLS

          return (
            <div
              key={dateStr}
              className={cn(
                "flex flex-col rounded-lg border",
                isToday && "border-t-2 border-t-primary bg-primary/[0.02]"
              )}
            >
              {/* Day Header */}
              <Link
                href={`/rides?date=${dateStr}`}
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
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">
                    {rides.length} {rides.length === 1 ? "Fahrt" : "Fahrten"}
                  </span>
                  {hasAlert && (
                    <AlertTriangle className="h-3 w-3 text-red-500" />
                  )}
                </div>
              </Link>

              {/* Ride Pills */}
              <div className="flex flex-1 flex-col gap-1 p-1.5">
                {rides.length === 0 ? (
                  <EmptyDayCell dateStr={dateStr} isStaff={isStaff} isPast={dateStr < today} />
                ) : (
                  <>
                    {rides.slice(0, MAX_PILLS).map((ride) => (
                      <RidePill key={ride.id} ride={ride} />
                    ))}
                    {overflow && (
                      <Link
                        href={`/rides?date=${dateStr}`}
                        className="mt-1 text-center text-xs text-muted-foreground hover:text-foreground"
                      >
                        + {rides.length - MAX_PILLS} weitere
                      </Link>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Mobile: Vertical list grouped by date */}
      <div className="space-y-4 lg:hidden">
        {weekDates.map((dateStr) => {
          const rides = ridesByDate.get(dateStr) ?? []
          const isToday = dateStr === today
          const hasAlert = rides.some(
            (r) => r.status === "unplanned" || r.status === "rejected"
          )

          return (
            <div key={dateStr}>
              <Link
                href={`/rides?date=${dateStr}`}
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
                {hasAlert && (
                  <AlertTriangle className="h-3 w-3 text-red-500" />
                )}
              </Link>
              {rides.length === 0 ? (
                <p className="px-2 text-xs text-muted-foreground">Keine Fahrten</p>
              ) : (
                <div className="space-y-1">
                  {rides.map((ride) => (
                    <RidePill key={ride.id} ride={ride} />
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

function RidePill({ ride }: { ride: WeekRide }) {
  const patient = ride.patients
  const patientLabel = patient
    ? `${patient.last_name}, ${patient.first_name.charAt(0)}.`
    : "\u2013"

  const isAlert = ride.status === "unplanned" || ride.status === "rejected"
  const isActive =
    ride.status === "in_progress" ||
    ride.status === "picked_up" ||
    ride.status === "arrived"
  const isCompleted = ride.status === "completed"

  return (
    <Link
      href={`/rides/${ride.id}`}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-muted hover:shadow-sm",
        isAlert && "border border-red-200 bg-red-50",
        isActive && "border border-amber-200 bg-amber-50",
        !isAlert && !isActive && "bg-muted/50",
        isCompleted && "opacity-60"
      )}
    >
      <span
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          RIDE_STATUS_DOT_COLORS[ride.status]
        )}
      />
      <span className="font-semibold tabular-nums">
        {ride.pickup_time.slice(0, 5)}
      </span>
      <span className="truncate">{patientLabel}</span>
    </Link>
  )
}

function EmptyDayCell({
  dateStr,
  isStaff,
  isPast,
}: {
  dateStr: string
  isStaff: boolean
  isPast: boolean
}) {
  return (
    <div className="flex min-h-[80px] flex-1 items-center justify-center rounded-md border border-dashed border-muted-foreground/20">
      {isStaff && !isPast ? (
        <Link
          href={`/rides/new?date=${dateStr}`}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          + Neue Fahrt
        </Link>
      ) : (
        <span className="text-xs text-muted-foreground">Keine Fahrten</span>
      )}
    </div>
  )
}
