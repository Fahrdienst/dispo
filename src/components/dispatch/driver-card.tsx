"use client"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { VEHICLE_TYPE_LABELS } from "@/lib/rides/constants"
import { formatDayLabel } from "@/lib/utils/dates"
import type { SplitDriver } from "@/components/dispatch/split-view-types"

interface DriverCardProps {
  driver: SplitDriver
}

/**
 * A single driver card in the split-view right column (M15, #168).
 *
 * Shows name, vehicle type, today's availability short-info and the ride count
 * for the selected period. Display-only in the grundgerüst — the `[Zuweisen]`
 * button, context grouping (Verfügbar/Konflikt/Nicht verfügbar) and drop-target
 * behaviour arrive with #169/#170.
 *
 * #187: an absence renders as a NEUTRAL "Nicht verfügbar bis …" — the absence
 * REASON (e.g. Krankheit) is never surfaced here.
 */
export function DriverCard({ driver }: DriverCardProps) {
  const availableToday = !driver.is_absent_today && driver.today_slots.length > 0

  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-md border px-3 py-2",
        availableToday
          ? "border-green-200 bg-green-50"
          : "border-gray-200 bg-gray-50"
      )}
    >
      <div className="flex flex-col">
        <span className="text-sm font-medium">
          {driver.last_name}, {driver.first_name}
        </span>
        <span className="text-xs text-muted-foreground">
          {VEHICLE_TYPE_LABELS[driver.vehicle_type]}
          {driver.is_absent_today ? (
            <>
              {" · "}
              <span>
                Nicht verfügbar
                {driver.absent_until && (
                  <> bis {formatDayLabel(driver.absent_until)}</>
                )}
              </span>
            </>
          ) : availableToday ? (
            <> {"·"} Heute: {driver.today_slots.join(", ")}</>
          ) : (
            <> {"·"} Heute nicht verfügbar</>
          )}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Badge
          variant={driver.period_ride_count > 0 ? "default" : "secondary"}
          className="tabular-nums"
          title="Fahrten diese Woche"
        >
          {driver.period_ride_count}
        </Badge>
        <span
          className={cn(
            "h-2.5 w-2.5 shrink-0 rounded-full",
            availableToday ? "bg-green-500" : "bg-gray-300"
          )}
          title={availableToday ? "Heute verfügbar" : "Heute nicht verfügbar"}
          aria-label={availableToday ? "Heute verfügbar" : "Heute nicht verfügbar"}
        />
      </div>
    </div>
  )
}
