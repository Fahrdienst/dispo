"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DriverCard } from "@/components/dispatch/driver-card"
import { formatDayLabel } from "@/lib/utils/dates"
import type {
  SplitDriver,
  SplitRide,
} from "@/components/dispatch/split-view-types"

interface DriverColumnProps {
  drivers: SplitDriver[]
  /**
   * The currently activated ride, if any. In the grundgerüst this only drives a
   * context header; the actual availability grouping/sorting + `[Zuweisen]`
   * (Verfügbar/Konflikt/Nicht verfügbar) is Issue #169. Kept as a prop so #169
   * can dock without touching the layout.
   */
  activeRide: SplitRide | null
}

/**
 * Right column of the split-view: the driver panel (M15, #168).
 *
 * Without an active ride it shows a flat, alphabetical list of active drivers
 * with today's availability. It is `sticky` on desktop so the driver context
 * stays visible while the (potentially long) ride list scrolls (Kim §1).
 */
export function DriverColumn({ drivers, activeRide }: DriverColumnProps) {
  return (
    <Card className="lg:sticky lg:top-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Fahrer</CardTitle>
        {activeRide && (
          <p className="text-xs text-muted-foreground">
            Aktive Fahrt: {formatDayLabel(activeRide.date)}{" "}
            {activeRide.pickup_time.slice(0, 5)} {"·"}{" "}
            {activeRide.destination_name}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {drivers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine aktiven Fahrer</p>
        ) : (
          drivers.map((driver) => (
            <DriverCard key={driver.id} driver={driver} />
          ))
        )}
      </CardContent>
    </Card>
  )
}
