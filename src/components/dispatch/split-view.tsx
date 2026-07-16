"use client"

import { useCallback, useMemo, useState } from "react"
import { RideColumn } from "@/components/dispatch/ride-column"
import { DriverColumn } from "@/components/dispatch/driver-column"
import { RideQuickSheet } from "@/components/rides/ride-quick-sheet"
import { ASSIGNMENT_STATUS_ORDER, type AssignmentStatus } from "@/lib/dispatch/assignment-status"
import type {
  SplitRide,
  SplitDriver,
} from "@/components/dispatch/split-view-types"

interface SplitViewProps {
  rides: SplitRide[]
  drivers: SplitDriver[]
}

/**
 * Split-view orchestrator (M15, #168): Fahrten links, Fahrer rechts.
 *
 * Owns the two pieces of client state the grundgerüst needs:
 *   - `activeTab`     — which of the four assignment buckets is shown.
 *   - `selectedRideId`— the "activated" ride. This is the docking point for the
 *     context-filtering + assign flow (#169): the driver panel already receives
 *     the active ride, it just doesn't filter/sort by it yet.
 *
 * A separate `detailRideId` drives the existing `RideQuickSheet` (ride detail).
 * Assign button, drag & drop and the live countdown are deliberately absent
 * here — they land in #169/#170/#171.
 */
export function SplitView({ rides, drivers }: SplitViewProps) {
  // Default to the first tab (in order) that actually has rides, else "offen".
  const initialTab = useMemo<AssignmentStatus>(() => {
    const present = new Set(rides.map((r) => r.assignmentStatus))
    return ASSIGNMENT_STATUS_ORDER.find((s) => present.has(s)) ?? "offen"
  }, [rides])

  const [activeTab, setActiveTab] = useState<AssignmentStatus>(initialTab)
  const [selectedRideId, setSelectedRideId] = useState<string | null>(null)
  const [detailRideId, setDetailRideId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const handleSelectRide = useCallback((rideId: string) => {
    // Toggle: clicking the active ride again de-selects it.
    setSelectedRideId((current) => (current === rideId ? null : rideId))
  }, [])

  const handleOpenDetail = useCallback((rideId: string) => {
    setDetailRideId(rideId)
    setSheetOpen(true)
  }, [])

  const activeRide = useMemo(
    () => rides.find((r) => r.id === selectedRideId) ?? null,
    [rides, selectedRideId]
  )

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_minmax(320px,420px)]">
        <RideColumn
          rides={rides}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          selectedRideId={selectedRideId}
          onSelectRide={handleSelectRide}
          onOpenDetail={handleOpenDetail}
        />
        <DriverColumn drivers={drivers} activeRide={activeRide} />
      </div>

      <RideQuickSheet
        rideId={detailRideId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  )
}
