"use client"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { VEHICLE_TYPE_LABELS } from "@/lib/rides/constants"
import { formatDayLabel } from "@/lib/utils/dates"
import type { DriverRideContext } from "@/lib/dispatch/driver-context"
import type { SplitDriver } from "@/components/dispatch/split-view-types"

interface DriverCardProps {
  driver: SplitDriver
  /**
   * Context relative to the ACTIVE ride (#169), or null when no ride is
   * selected (default panel: today's availability, display-only).
   */
  context?: DriverRideContext | null
  /** Assign affordance — only rendered when `context` is present + assignable. */
  onAssign?: (driver: SplitDriver) => void
  /** Disables the assign button while a request is in flight. */
  assignPending?: boolean
}

/**
 * A single driver card in the split-view right column (M15, #168/#169).
 *
 * Without an active ride: name, vehicle type, today's availability short-info
 * and the ride count for the selected period. With an active ride the card
 * shows the driver's context to THAT ride — verfügbar (green, [Zuweisen]),
 * Konflikt/Ausserhalb (grayed with Grund, still assignable behind the
 * «Trotzdem zuweisen» pre-question) or abwesend (grayed, not assignable).
 *
 * #187: an absence renders as a NEUTRAL "Nicht verfügbar bis …" — the absence
 * REASON (e.g. Krankheit) is never surfaced here.
 */
export function DriverCard({
  driver,
  context = null,
  onAssign,
  assignPending = false,
}: DriverCardProps) {
  const availableToday = !driver.is_absent_today && driver.today_slots.length > 0

  // Card tint: with context it encodes the context state, otherwise today's
  // availability (grundgerüst behavior).
  const highlighted = context ? context.state === "verfuegbar" : availableToday

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 rounded-md border px-3 py-2",
        highlighted
          ? "border-green-200 bg-green-50"
          : "border-gray-200 bg-gray-50",
        context && !context.assignable && "opacity-60"
      )}
    >
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium">
          {driver.last_name}, {driver.first_name}
        </span>
        <span className="text-xs text-muted-foreground">
          {VEHICLE_TYPE_LABELS[driver.vehicle_type]}
          {context ? (
            context.reason && (
              <>
                {" · "}
                <span
                  className={cn(
                    context.state === "konflikt" && "text-amber-700"
                  )}
                >
                  {context.reason}
                </span>
              </>
            )
          ) : driver.is_absent_today ? (
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

      <div className="flex shrink-0 items-center gap-2">
        <Badge
          variant={driver.period_ride_count > 0 ? "default" : "secondary"}
          className="tabular-nums"
          title="Fahrten diese Woche"
        >
          {driver.period_ride_count}
        </Badge>
        {context ? (
          context.assignable && onAssign ? (
            <Button
              size="sm"
              variant={context.state === "verfuegbar" ? "default" : "outline"}
              disabled={assignPending}
              onClick={() => onAssign(driver)}
              aria-label={`${driver.first_name} ${driver.last_name} zuweisen`}
            >
              Zuweisen
            </Button>
          ) : (
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full bg-gray-300"
              title="Nicht zuweisbar"
              aria-label="Nicht zuweisbar"
            />
          )
        ) : (
          <span
            className={cn(
              "h-2.5 w-2.5 shrink-0 rounded-full",
              availableToday ? "bg-green-500" : "bg-gray-300"
            )}
            title={availableToday ? "Heute verfügbar" : "Heute nicht verfügbar"}
            aria-label={
              availableToday ? "Heute verfügbar" : "Heute nicht verfügbar"
            }
          />
        )}
      </div>
    </div>
  )
}
