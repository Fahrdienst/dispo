"use client"

import { useTransition, useMemo, useState, useCallback } from "react"
import Link from "next/link"
import { Check, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RideStatusBadge } from "@/components/shared/ride-status-badge"
import {
  RIDE_STATUS_LABELS,
  RIDE_STATUS_BORDER_COLORS,
  RIDE_DIRECTION_LABELS,
  VEHICLE_TYPE_LABELS,
} from "@/lib/rides/constants"
import { assignDriver } from "@/actions/rides"
import type { Enums } from "@/lib/types/database"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RideStatus = Enums<"ride_status">
type VehicleType = Enums<"vehicle_type">

export interface DispatchRide {
  id: string
  pickup_time: string
  date: string
  status: RideStatus
  direction: Enums<"ride_direction">
  notes: string | null
  driver_id: string | null
  appointment_time: string | null
  parent_ride_id: string | null
  patient_first_name: string
  patient_last_name: string
  destination_name: string
}

export interface DispatchDriver {
  id: string
  first_name: string
  last_name: string
  vehicle_type: VehicleType
}

/** Map from driver ID to set of available slot start times (e.g. "08:00") */
export type DriverAvailabilityMap = Record<string, string[]>

interface DispatchBoardProps {
  rides: DispatchRide[]
  drivers: DispatchDriver[]
  driverAvailability: DriverAvailabilityMap
  selectedDate: string
  today: string
}

// ---------------------------------------------------------------------------
// Time Slot Helpers
// ---------------------------------------------------------------------------

/** 2h dispatch slots as defined in the availability model. */
const SLOT_BOUNDARIES = [
  { start: "08:00", end: "10:00" },
  { start: "10:00", end: "12:00" },
  { start: "12:00", end: "14:00" },
  { start: "14:00", end: "16:00" },
  { start: "16:00", end: "18:00" },
] as const

/**
 * Determine which 2h slot a pickup_time falls into.
 * Returns the slot start time (e.g. "08:00") or null if outside all slots.
 */
function getSlotForTime(pickupTime: string): string | null {
  // pickup_time format: "HH:MM:SS" or "HH:MM"
  const hhmm = pickupTime.substring(0, 5)
  for (const slot of SLOT_BOUNDARIES) {
    if (hhmm >= slot.start && hhmm < slot.end) {
      return slot.start
    }
  }
  return null
}

/**
 * Format a time string "HH:MM:SS" or "HH:MM" to "HH:MM" for display.
 */
function formatTime(time: string): string {
  return time.substring(0, 5)
}

// ---------------------------------------------------------------------------
// Status Filter Constants
// ---------------------------------------------------------------------------

const ALL_STATUSES: RideStatus[] = [
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

/** Active chip background colors per status. */
const STATUS_CHIP_COLORS: Record<RideStatus, string> = {
  unplanned:   "bg-gray-600 text-white",
  planned:     "bg-blue-500 text-white",
  confirmed:   "bg-indigo-500 text-white",
  rejected:    "bg-red-500 text-white",
  in_progress: "bg-amber-500 text-white",
  picked_up:   "bg-orange-500 text-white",
  arrived:     "bg-teal-500 text-white",
  completed:   "bg-green-600 text-white",
  cancelled:   "bg-slate-400 text-white",
  no_show:     "bg-rose-600 text-white",
}

// ---------------------------------------------------------------------------
// Day Navigation Helpers
// ---------------------------------------------------------------------------

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + "T00:00:00")
  date.setDate(date.getDate() + days)
  return date.toISOString().split("T")[0]!
}

function formatDateDE(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00")
  return date.toLocaleDateString("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

// ---------------------------------------------------------------------------
// Sub-Components
// ---------------------------------------------------------------------------

interface DriverSelectProps {
  rideId: string
  currentDriverId: string | null
  drivers: DispatchDriver[]
  availableSlots: Set<string>
  rideSlot: string | null
  conflictDriverIds: Set<string>
  isPending: boolean
  onAssign: (rideId: string, driverId: string | null) => void
}

function DriverSelect({
  rideId,
  currentDriverId,
  drivers,
  availableSlots,
  rideSlot,
  conflictDriverIds,
  isPending,
  onAssign,
}: DriverSelectProps) {
  const handleChange = (value: string) => {
    onAssign(rideId, value === "__none__" ? null : value)
  }

  const isUnassigned = currentDriverId === null

  return (
    <Select
      value={currentDriverId ?? "__none__"}
      onValueChange={handleChange}
      disabled={isPending}
    >
      <SelectTrigger
        className={cn(
          isUnassigned && "border-amber-300 bg-amber-50/50"
        )}
        aria-label="Fahrer zuweisen"
      >
        <SelectValue placeholder={"— Fahrer zuweisen —"} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">— Kein Fahrer —</SelectItem>
        {drivers.map((driver) => {
          const isAvailable =
            rideSlot !== null &&
            availableSlots.has(rideSlot + ":" + driver.id)
          const hasConflict = conflictDriverIds.has(driver.id)

          return (
            <SelectItem key={driver.id} value={driver.id}>
              <span className="flex items-center gap-2">
                {isAvailable && (
                  <Check className="h-3.5 w-3.5 shrink-0 text-green-600" />
                )}
                {hasConflict && (
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                )}
                <span>
                  {driver.last_name}, {driver.first_name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {VEHICLE_TYPE_LABELS[driver.vehicle_type]}
                </span>
              </span>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function DispatchBoard({
  rides,
  drivers,
  driverAvailability,
  selectedDate,
  today,
}: DispatchBoardProps) {
  const [isPending, startTransition] = useTransition()
  const [statusFilter, setStatusFilter] = useState<RideStatus | "all">("all")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // -- Derived data --

  // Build a set of "slot:driverId" for quick availability lookups
  const availableSlotSet = useMemo(() => {
    const set = new Set<string>()
    for (const [driverId, slots] of Object.entries(driverAvailability)) {
      for (const slot of slots) {
        set.add(slot + ":" + driverId)
      }
    }
    return set
  }, [driverAvailability])

  // Build conflict map: for each slot, which drivers already have rides
  const slotDriverConflicts = useMemo(() => {
    const map = new Map<string, Map<string, number>>()
    for (const ride of rides) {
      if (!ride.driver_id) continue
      // Only count non-terminal rides as conflicts
      if (ride.status === "cancelled" || ride.status === "completed" || ride.status === "no_show") continue
      const slot = getSlotForTime(ride.pickup_time)
      if (!slot) continue
      const driverMap = map.get(slot) ?? new Map<string, number>()
      driverMap.set(ride.driver_id, (driverMap.get(ride.driver_id) ?? 0) + 1)
      map.set(slot, driverMap)
    }
    return map
  }, [rides])

  /**
   * For a given ride, return the set of driver IDs that have a conflict
   * (already assigned to another ride in the same slot).
   */
  const getConflictDriverIds = useCallback(
    (ride: DispatchRide): Set<string> => {
      const slot = getSlotForTime(ride.pickup_time)
      if (!slot) return new Set()
      const driverMap = slotDriverConflicts.get(slot)
      if (!driverMap) return new Set()

      const conflicts = new Set<string>()
      for (const [driverId, count] of driverMap) {
        // A driver has a conflict if they have rides in this slot
        // but exclude the current ride's own driver from its own conflict count
        if (driverId === ride.driver_id) {
          if (count > 1) conflicts.add(driverId)
        } else {
          conflicts.add(driverId)
        }
      }
      return conflicts
    },
    [slotDriverConflicts]
  )

  // Filter rides by status
  const filteredRides = useMemo(() => {
    if (statusFilter === "all") return rides
    return rides.filter((r) => r.status === statusFilter)
  }, [rides, statusFilter])

  // Count rides per driver (non-terminal only)
  const driverRideCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const ride of rides) {
      if (!ride.driver_id) continue
      if (ride.status === "cancelled" || ride.status === "completed" || ride.status === "no_show") continue
      counts.set(ride.driver_id, (counts.get(ride.driver_id) ?? 0) + 1)
    }
    return counts
  }, [rides])

  // Count rides per status for filter badges
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const ride of rides) {
      counts[ride.status] = (counts[ride.status] ?? 0) + 1
    }
    return counts
  }, [rides])

  // -- Handlers --

  const handleAssign = useCallback(
    (rideId: string, driverId: string | null) => {
      setErrorMessage(null)
      startTransition(async () => {
        const result = await assignDriver(rideId, driverId)
        if (!result.success) {
          setErrorMessage(result.error ?? "Fehler bei der Fahrerzuweisung")
        }
      })
    },
    []
  )

  // -- Navigation --

  const prevDate = addDays(selectedDate, -1)
  const nextDate = addDays(selectedDate, 1)

  // -- Count unassigned rides --
  const unassignedCount = rides.filter(
    (r) => !r.driver_id && r.status !== "cancelled" && r.status !== "completed" && r.status !== "no_show"
  ).length

  return (
    <div className="space-y-6">
      {/* Day Navigation */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/dispatch?date=${prevDate}`}>
            &larr; Vorheriger Tag
          </Link>
        </Button>
        <span className="px-3 text-sm font-medium">
          {formatDateDE(selectedDate)}
        </span>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/dispatch?date=${nextDate}`}>
            Naechster Tag &rarr;
          </Link>
        </Button>
        {selectedDate !== today && (
          <Button variant="outline" size="sm" asChild>
            <Link href="/dispatch">Heute</Link>
          </Button>
        )}
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {errorMessage}
        </div>
      )}

      {/* Stats Bar */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="font-medium">
          {rides.length} {rides.length === 1 ? "Fahrt" : "Fahrten"}
        </span>
        {unassignedCount > 0 && (
          <Badge variant="destructive">
            {unassignedCount} ohne Fahrer
          </Badge>
        )}
      </div>

      {/* Status Filter Chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setStatusFilter("all")}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-colors",
            statusFilter === "all"
              ? "bg-foreground text-background"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          Alle ({rides.length})
        </button>
        {ALL_STATUSES.map((status) => {
          const count = statusCounts[status] ?? 0
          if (count === 0) return null
          const isActive = statusFilter === status
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                isActive
                  ? STATUS_CHIP_COLORS[status]
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {RIDE_STATUS_LABELS[status]} ({count})
            </button>
          )
        })}
      </div>

      {/* Main Content: Rides + Driver Sidebar */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* Ride List */}
        <div className="space-y-2">
          {filteredRides.length === 0 ? (
            <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed">
              <p className="text-muted-foreground">
                {statusFilter === "all"
                  ? "Keine Fahrten fuer diesen Tag"
                  : `Keine Fahrten mit Status "${RIDE_STATUS_LABELS[statusFilter]}"`}
              </p>
            </div>
          ) : (
            filteredRides.map((ride) => {
              const slot = getSlotForTime(ride.pickup_time)
              const conflictDriverIds = getConflictDriverIds(ride)
              const hasOwnConflict = ride.driver_id !== null && conflictDriverIds.has(ride.driver_id)

              return (
                <div
                  key={ride.id}
                  className={cn(
                    "rounded-lg border bg-card p-4 shadow-sm",
                    "border-l-4",
                    ride.status === "unplanned" && !ride.driver_id
                      ? "border-l-red-600"
                      : RIDE_STATUS_BORDER_COLORS[ride.status]
                  )}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    {/* Left: Time + Patient + Destination */}
                    <div className="flex flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                      <span className="w-14 shrink-0 font-mono text-sm font-semibold">
                        {formatTime(ride.pickup_time)}
                      </span>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {ride.patient_last_name}, {ride.patient_first_name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {ride.destination_name}
                          {" \u2013 "}
                          {RIDE_DIRECTION_LABELS[ride.direction]}
                        </span>
                        {ride.appointment_time && (
                          <span className="text-xs text-muted-foreground">
                            Termin: {formatTime(ride.appointment_time)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Middle: Status Badge + Conflict Warning + Return Badge */}
                    <div className="flex items-center gap-2">
                      <RideStatusBadge status={ride.status} />
                      {ride.parent_ride_id && (
                        <Badge variant="outline" className="text-xs">
                          Rueckfahrt
                        </Badge>
                      )}
                      {hasOwnConflict && (
                        <Badge
                          variant="outline"
                          className="border-amber-400 bg-amber-50 text-amber-800"
                        >
                          Konflikt
                        </Badge>
                      )}
                    </div>

                    {/* Right: Driver Select */}
                    <div className="w-full sm:w-64">
                      <DriverSelect
                        rideId={ride.id}
                        currentDriverId={ride.driver_id}
                        drivers={drivers}
                        availableSlots={availableSlotSet}
                        rideSlot={slot}
                        conflictDriverIds={conflictDriverIds}
                        isPending={isPending}
                        onAssign={handleAssign}
                      />
                    </div>
                  </div>
                  {ride.notes && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {ride.notes}
                    </p>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Driver Sidebar */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Fahrer-Uebersicht
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {drivers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine aktiven Fahrer
              </p>
            ) : (
              drivers.map((driver) => {
                const rideCount = driverRideCounts.get(driver.id) ?? 0
                const availableSlots = driverAvailability[driver.id] ?? []
                const isAvailableToday = availableSlots.length > 0

                return (
                  <div
                    key={driver.id}
                    className={cn(
                      "flex items-center justify-between rounded-md border px-3 py-2",
                      isAvailableToday ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50"
                    )}
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">
                        {driver.last_name}, {driver.first_name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {VEHICLE_TYPE_LABELS[driver.vehicle_type]}
                        {isAvailableToday && (
                          <> &middot; Verfuegbar: {availableSlots.map(formatTime).join(", ")}</>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={rideCount > 0 ? "default" : "secondary"}
                        className="tabular-nums"
                      >
                        {rideCount}
                      </Badge>
                      <span
                        className={cn(
                          "h-2.5 w-2.5 shrink-0 rounded-full",
                          isAvailableToday ? "bg-green-500" : "bg-gray-300"
                        )}
                        title={isAvailableToday ? "Heute verfuegbar" : "Heute nicht verfuegbar"}
                        aria-label={isAvailableToday ? "Heute verfuegbar" : "Heute nicht verfuegbar"}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
