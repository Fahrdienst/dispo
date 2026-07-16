"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { RideCard } from "@/components/dispatch/ride-card"
import {
  ASSIGNMENT_STATUS_ORDER,
  ASSIGNMENT_STATUS_LABELS,
  ASSIGNMENT_STATUS_TAB_ACTIVE_COLORS,
  type AssignmentStatus,
} from "@/lib/dispatch/assignment-status"
import type { SplitRide } from "@/components/dispatch/split-view-types"

interface RideColumnProps {
  rides: SplitRide[]
  activeTab: AssignmentStatus
  onTabChange: (tab: AssignmentStatus) => void
  selectedRideId: string | null
  onSelectRide: (rideId: string) => void
  onOpenDetail: (rideId: string) => void
}

/**
 * Left column of the split-view: status tabs with counters + the filtered ride
 * list (M15, #168).
 *
 * Exactly four buckets (concept §0). The "Abgelehnt" tab is only rendered when
 * its count > 0 (reduces noise on quiet days, Kim §2); the other three are
 * always visible even at 0. No "Alle" tab — the four buckets are complete and
 * non-overlapping for the assignment question.
 */
export function RideColumn({
  rides,
  activeTab,
  onTabChange,
  selectedRideId,
  onSelectRide,
  onOpenDetail,
}: RideColumnProps) {
  const counts = useMemo(() => {
    const c: Record<AssignmentStatus, number> = {
      offen: 0,
      angefragt: 0,
      bestaetigt: 0,
      abgelehnt: 0,
    }
    for (const ride of rides) c[ride.assignmentStatus]++
    return c
  }, [rides])

  const visibleRides = useMemo(
    () => rides.filter((r) => r.assignmentStatus === activeTab),
    [rides, activeTab]
  )

  return (
    <div className="space-y-4">
      {/* Status tabs */}
      <div
        role="tablist"
        aria-label="Fahrten nach Zuteilungsstatus"
        className="flex flex-wrap gap-2"
      >
        {ASSIGNMENT_STATUS_ORDER.map((status) => {
          const count = counts[status]
          // Abgelehnt only appears when there is something to show.
          if (status === "abgelehnt" && count === 0) return null
          const isActive = activeTab === status
          return (
            <button
              key={status}
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabChange(status)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? ASSIGNMENT_STATUS_TAB_ACTIVE_COLORS[status]
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {ASSIGNMENT_STATUS_LABELS[status]}{" "}
              <span className="tabular-nums">{count}</span>
            </button>
          )
        })}
      </div>

      {/* Ride list */}
      {visibleRides.length === 0 ? (
        <div className="flex min-h-[160px] items-center justify-center rounded-lg border border-dashed">
          <p className="text-sm text-muted-foreground">
            Keine Fahrten mit Status „{ASSIGNMENT_STATUS_LABELS[activeTab]}“
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {visibleRides.map((ride) => (
            <RideCard
              key={ride.id}
              ride={ride}
              isSelected={selectedRideId === ride.id}
              onSelect={onSelectRide}
              onOpenDetail={onOpenDetail}
            />
          ))}
        </div>
      )}
    </div>
  )
}
