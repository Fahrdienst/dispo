"use client"

import { useState } from "react"
import { CornerDownLeft, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { AssignmentStatusBadge } from "@/components/dispatch/assignment-status-badge"
import { ASSIGNMENT_STATUS_BORDER_COLORS } from "@/lib/dispatch/assignment-status"
import {
  RIDE_REQUIREMENT_LABELS,
  RIDE_DIRECTION_LABELS,
} from "@/lib/rides/constants"
import { formatDayLabel } from "@/lib/utils/dates"
import type { SplitRide } from "@/components/dispatch/split-view-types"

/** "HH:MM:SS" | "HH:MM" -> "HH:MM". */
function formatTime(time: string): string {
  return time.slice(0, 5)
}

/** ISO timestamp -> "17.07. 16:40" (Europe/Zurich wall clock is fine here). */
function formatEventTime(iso: string): string {
  const d = new Date(iso)
  const day = String(d.getDate()).padStart(2, "0")
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  return `${day}.${month}. ${hh}:${mm}`
}

/**
 * Build the "Von → Nach" label from trip direction. The patient's home town is
 * one end, the facility the other. Falls back gracefully when the city is
 * missing (only operationally relevant location data is shown — #179).
 * Exported for the assign confirm dialog (#169), which names the same trip.
 */
export function tripLabel(ride: SplitRide): string {
  const home = ride.patient_city?.trim() || "Zuhause"
  const facility = ride.destination_name
  switch (ride.direction) {
    case "outbound":
      return `${home} → ${facility}`
    case "return":
      return `${facility} → ${home}`
    case "both":
      return `${home} ⇄ ${facility}`
    default:
      return facility
  }
}

interface RideCardProps {
  ride: SplitRide
  isSelected: boolean
  onSelect: (rideId: string) => void
  onOpenDetail: (rideId: string) => void
  /**
   * Desktop drag & drop (#170): when true, the card can be dragged onto a
   * driver card. Purely additive — selection + click flow stay fully usable
   * (touch/keyboard never see this affordance).
   */
  draggable?: boolean
  onDragStart?: (rideId: string) => void
  onDragEnd?: () => void
}

/**
 * A single ride card in the split-view left column (M15, #168–#170).
 *
 * Clicking the card ACTIVATES the ride (context-filtering + assign flow in the
 * driver panel, #169). On desktop the card is additionally draggable onto a
 * driver card (#170) — dropping it opens the SAME confirm dialog as the click
 * flow. A dedicated "Details" button opens the existing `RideQuickSheet`.
 * The live countdown is intentionally out of scope here (#171).
 */
export function RideCard({
  ride,
  isSelected,
  onSelect,
  onOpenDetail,
  draggable = false,
  onDragStart,
  onDragEnd,
}: RideCardProps) {
  const isReturn = ride.parent_ride_id !== null
  const [isDragging, setIsDragging] = useState(false)

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      onClick={() => onSelect(ride.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect(ride.id)
        }
      }}
      draggable={draggable}
      onDragStart={
        draggable
          ? (e) => {
              // Firefox needs data for the drag to start; the actual payload
              // travels via React state (drag start activates the ride).
              e.dataTransfer.setData("text/plain", ride.id)
              e.dataTransfer.effectAllowed = "move"
              setIsDragging(true)
              onDragStart?.(ride.id)
            }
          : undefined
      }
      onDragEnd={
        draggable
          ? () => {
              setIsDragging(false)
              onDragEnd?.()
            }
          : undefined
      }
      className={cn(
        "cursor-pointer rounded-lg border border-l-4 bg-card p-4 shadow-sm transition-colors hover:bg-muted/50",
        ASSIGNMENT_STATUS_BORDER_COLORS[ride.assignmentStatus],
        isSelected && "ring-2 ring-primary ring-offset-2",
        draggable && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50"
      )}
    >
      {/* Row 1: date + time · status badge (+ overdue marker) */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold tabular-nums">
          {formatDayLabel(ride.date)} {"·"} {formatTime(ride.pickup_time)}
        </span>
        <div className="flex items-center gap-1.5">
          {ride.assignmentStatus === "angefragt" && ride.overdue && (
            <Badge
              variant="outline"
              className="border-red-300 bg-red-50 text-red-700"
            >
              <AlertTriangle className="mr-1 h-3 w-3" aria-hidden="true" />
              Überfällig
            </Badge>
          )}
          {isReturn && (
            <Badge variant="outline" className="text-xs">
              Rückfahrt
            </Badge>
          )}
          <AssignmentStatusBadge status={ride.assignmentStatus} />
        </div>
      </div>

      {/* Row 2: Von → Nach */}
      <p className="mt-1.5 text-sm font-medium">{tripLabel(ride)}</p>

      {/* Row 3: patient + requirements (staff view — operational data only, #179) */}
      <p className="mt-0.5 text-xs text-muted-foreground">
        {ride.patient_last_name}, {ride.patient_first_name}
        {ride.requirements.length > 0 && (
          <>
            {" · "}
            {ride.requirements
              .map((r) => RIDE_REQUIREMENT_LABELS[r])
              .join(", ")}
          </>
        )}
        {" · "}
        {RIDE_DIRECTION_LABELS[ride.direction]}
      </p>

      {/* Row 4: linked return reference */}
      {ride.linked_return_time && (
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <CornerDownLeft className="h-3 w-3" aria-hidden="true" />
          Rückfahrt {formatTime(ride.linked_return_time)} Uhr
        </p>
      )}

      {/* Row 5a: requested driver (Angefragt) */}
      {ride.assignmentStatus === "angefragt" && ride.assigned_driver_name && (
        <p className="mt-1 text-xs text-amber-700">
          → angefragt: {ride.assigned_driver_name}
        </p>
      )}

      {/* Row 5b: rejection note (Abgelehnt) */}
      {ride.assignmentStatus === "abgelehnt" && ride.rejected_by_name && (
        <p className="mt-1 text-xs text-rose-700">
          ⛔ Abgelehnt von {ride.rejected_by_name}
          {ride.rejected_at && <> {"·"} {formatEventTime(ride.rejected_at)}</>}
        </p>
      )}

      {/* Row 6: detail affordance (RideQuickSheet stays the detail surface) */}
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onOpenDetail(ride.id)
          }}
          className="rounded px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Details
        </button>
      </div>
    </div>
  )
}
