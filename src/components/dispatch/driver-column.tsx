"use client"

import { useCallback, useMemo, useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { DriverCard } from "@/components/dispatch/driver-card"
import { tripLabel } from "@/components/dispatch/ride-card"
import { assignDriver, assignDriverWithReturn } from "@/actions/rides"
import {
  resolveDriverRideContext,
  sortDriversByContext,
  type DriverRideContext,
} from "@/lib/dispatch/driver-context"
import { formatDayLabel } from "@/lib/utils/dates"
import type {
  SplitDriver,
  SplitRide,
} from "@/components/dispatch/split-view-types"

interface DriverColumnProps {
  drivers: SplitDriver[]
  /** All rides of the period — needed for time-conflict detection (#169). */
  rides: SplitRide[]
  /** The currently activated ride; drives context filtering + assignment. */
  activeRide: SplitRide | null
  /** Called after a successful assignment (parent clears the selection). */
  onAssigned?: () => void
  /**
   * True while a ride card is being dragged (#170). Assignable driver cards
   * become drop targets; a drop enters the SAME dialog flow as [Zuweisen].
   */
  dragActive?: boolean
}

/** "HH:MM:SS" | "HH:MM" -> "HH:MM". */
function formatTime(time: string): string {
  return time.slice(0, 5)
}

/**
 * Right column of the split-view: the driver panel (M15, #168/#169).
 *
 * Without an active ride: flat alphabetical list with today's availability.
 * With an active ride the panel re-sorts by context — drivers available at the
 * ride's pickup time and without an overlapping ride on top, everyone else
 * grayed WITH the reason (concept §2.2). Assignment runs through [Zuweisen] →
 * (optional «Trotzdem zuweisen?» pre-question for Konflikt/Ausserhalb, #104
 * pattern) → confirm dialog with the Rückfahrt checkbox (#167) → server action.
 *
 * Absent drivers are never assignable here; the server guard (#182) would
 * reject them anyway — the UI gray-out is convenience, not the control.
 */
export function DriverColumn({
  drivers,
  rides,
  activeRide,
  onAssigned,
  dragActive = false,
}: DriverColumnProps) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  /** Pre-question state («Trotzdem zuweisen?») for Konflikt/Ausserhalb. */
  const [override, setOverride] = useState<{
    driver: SplitDriver
    context: DriverRideContext
  } | null>(null)
  /** Confirm dialog state («Fahrt anfragen?»). */
  const [confirmDriver, setConfirmDriver] = useState<SplitDriver | null>(null)
  const [includeReturn, setIncludeReturn] = useState(true)

  // Assignment is offered for rides still looking for a driver. Angefragt /
  // Bestätigt cards give context only — Umplanung is a separate flow.
  const assignMode =
    activeRide !== null &&
    (activeRide.assignmentStatus === "offen" ||
      activeRide.assignmentStatus === "abgelehnt")

  // -- Context resolution + sorting (pure logic in driver-context.ts) --
  const contextById = useMemo(() => {
    const map = new Map<string, DriverRideContext>()
    if (!activeRide) return map
    for (const driver of drivers) {
      map.set(driver.id, resolveDriverRideContext(activeRide, driver, rides))
    }
    return map
  }, [activeRide, drivers, rides])

  const orderedDrivers = useMemo(
    () =>
      activeRide ? sortDriversByContext(drivers, contextById) : drivers,
    [activeRide, drivers, contextById]
  )

  const availableCount = useMemo(() => {
    let n = 0
    for (const ctx of contextById.values()) {
      if (ctx.state === "verfuegbar") n++
    }
    return n
  }, [contextById])

  // -- Assign flow --

  const openConfirm = useCallback(
    (driver: SplitDriver) => {
      // Rückfahrt mitanfragen is on by default when a linked leg exists (#169).
      setIncludeReturn(activeRide?.linked_return_time !== null)
      setConfirmDriver(driver)
    },
    [activeRide]
  )

  const handleAssignClick = useCallback(
    (driver: SplitDriver) => {
      const context = contextById.get(driver.id)
      if (!context || !context.assignable) return
      if (context.needsOverride) {
        setOverride({ driver, context })
        return
      }
      openConfirm(driver)
    },
    [contextById, openConfirm]
  )

  const handleOverrideConfirm = useCallback(() => {
    if (override) openConfirm(override.driver)
    setOverride(null)
  }, [override, openConfirm])

  const handleSendRequest = useCallback(() => {
    if (!activeRide || !confirmDriver) return
    const ride = activeRide
    const driver = confirmDriver
    const withReturn = ride.linked_return_time !== null
    const driverName = `${driver.first_name} ${driver.last_name}`
    setConfirmDriver(null)

    startTransition(async () => {
      let returnSkipped = false

      if (withReturn) {
        const result = await assignDriverWithReturn(ride.id, driver.id, {
          includeReturn,
        })
        if (!result.success) {
          toast({
            variant: "destructive",
            title: "Anfrage fehlgeschlagen",
            description:
              result.error ?? "Unbekannter Fehler bei der Zuweisung.",
          })
          return
        }
        returnSkipped =
          includeReturn &&
          result.data.returnLegSkippedReason === "not_assignable"
      } else {
        const result = await assignDriver(ride.id, driver.id)
        if (!result.success) {
          toast({
            variant: "destructive",
            title: "Anfrage fehlgeschlagen",
            description:
              result.error ?? "Unbekannter Fehler bei der Zuweisung.",
          })
          return
        }
      }

      toast({
        title: `Anfrage an ${driverName} gesendet`,
        description: returnSkipped
          ? "Die Fahrt ist jetzt angefragt. Die Rückfahrt konnte nicht mit angefragt werden (nicht mehr zuweisbar)."
          : withReturn && includeReturn
            ? "Fahrt und Rückfahrt sind jetzt angefragt."
            : "Die Fahrt ist jetzt angefragt.",
      })
      onAssigned?.()
    })
  }, [activeRide, confirmDriver, includeReturn, toast, onAssigned])

  // -- Dialog copy --

  const overrideTitle =
    override?.context.state === "konflikt"
      ? "Zeitkonflikt"
      : "Ausserhalb der Verfügbarkeit"

  return (
    <>
      <Card className="lg:sticky lg:top-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Fahrer</CardTitle>
          {activeRide && (
            <p className="text-xs text-muted-foreground">
              Aktive Fahrt: {formatDayLabel(activeRide.date)}{" "}
              {formatTime(activeRide.pickup_time)} {"·"}{" "}
              {activeRide.destination_name}
              {" — "}
              <span className="tabular-nums">{availableCount}</span> verfügbar
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {drivers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine aktiven Fahrer</p>
          ) : (
            orderedDrivers.map((driver) => (
              <DriverCard
                key={driver.id}
                driver={driver}
                context={activeRide ? contextById.get(driver.id) ?? null : null}
                onAssign={assignMode ? handleAssignClick : undefined}
                assignPending={isPending}
                dropActive={dragActive && assignMode}
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* Pre-question: assignment despite conflict / outside availability. */}
      <AlertDialog
        open={override !== null}
        onOpenChange={(open) => !open && setOverride(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{overrideTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {override && (
                <>
                  {override.driver.first_name} {override.driver.last_name}
                  {": "}
                  {override.context.reason}. Trotzdem zuweisen?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleOverrideConfirm}>
              Trotzdem zuweisen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm dialog: «Fahrt anfragen?» (wording per #169). */}
      <AlertDialog
        open={confirmDriver !== null}
        onOpenChange={(open) => !open && setConfirmDriver(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fahrt anfragen?</AlertDialogTitle>
            <AlertDialogDescription>
              {activeRide && confirmDriver && (
                <>
                  {formatDayLabel(activeRide.date)},{" "}
                  {formatTime(activeRide.pickup_time)} Uhr —{" "}
                  {tripLabel(activeRide)} an {confirmDriver.first_name}{" "}
                  {confirmDriver.last_name} anfragen?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {activeRide?.linked_return_time && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="include-return"
                checked={includeReturn}
                onCheckedChange={(checked) =>
                  setIncludeReturn(checked === true)
                }
              />
              <Label htmlFor="include-return" className="text-sm font-normal">
                Rückfahrt {formatTime(activeRide.linked_return_time)} Uhr mit
                anfragen
              </Label>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleSendRequest}>
              Anfrage senden
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
