"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, Navigation } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { RideStatusBadge } from "@/components/shared/ride-status-badge"
import { EmptyState } from "@/components/shared/empty-state"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { updateRideStatus } from "@/actions/rides"
import { reportRideProblem } from "@/actions/rides-driver"
import { getValidTransitionsForRole } from "@/lib/rides/status-machine"
import {
  RIDE_STATUS_LABELS,
  RIDE_DIRECTION_LABELS,
  RIDE_STATUS_BORDER_COLORS,
  RIDE_STATUS_DOT_COLORS,
} from "@/lib/rides/constants"
import type { Enums } from "@/lib/types/database"

// ---------------------------------------------------------------------------
// Driver-facing action labels (clear, simple language)
// ---------------------------------------------------------------------------

const DRIVER_ACTION_LABELS: Partial<Record<Enums<"ride_status">, string>> = {
  in_progress: "Fahrt starten",
  picked_up: "Patient abgeholt",
  arrived: "Am Ziel angekommen",
  completed: "Fahrt abgeschlossen",
  rejected: "Ablehnen",
  no_show: "Nicht erschienen",
}

// ---------------------------------------------------------------------------
// Color mapping for driver action buttons (by target status)
// ---------------------------------------------------------------------------

const DRIVER_ACTION_COLORS: Partial<Record<Enums<"ride_status">, string>> = {
  in_progress:
    "bg-amber-500 text-white hover:bg-amber-600 focus-visible:ring-amber-400",
  picked_up:
    "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-400",
  arrived:
    "bg-teal-600 text-white hover:bg-teal-700 focus-visible:ring-teal-400",
  completed:
    "bg-green-600 text-white hover:bg-green-700 focus-visible:ring-green-400",
}

/** Steps shown in the driver progress indicator (in order). */
const DRIVER_PROGRESS_STEPS = [
  { status: "planned", label: "Geplant" },
  { status: "confirmed", label: "Bestaetigt" },
  { status: "in_progress", label: "Unterwegs" },
  { status: "picked_up", label: "Abgeholt" },
  { status: "arrived", label: "Angekommen" },
  { status: "completed", label: "Abgeschlossen" },
] as const

interface MyRide {
  id: string
  pickup_time: string
  date: string
  status: Enums<"ride_status">
  direction: Enums<"ride_direction">
  notes: string | null
  patient_first_name: string
  patient_last_name: string
  destination_name: string
  destination_address: string | null
}

interface MyRidesListProps {
  rides: MyRide[]
}

export function MyRidesList({ rides }: MyRidesListProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  // Confirmation dialog state (for "completed" transition)
  const [confirmRideId, setConfirmRideId] = useState<string | null>(null)
  const [confirmStatus, setConfirmStatus] =
    useState<Enums<"ride_status"> | null>(null)

  // Problem report dialog state
  const [problemRideId, setProblemRideId] = useState<string | null>(null)
  const [problemText, setProblemText] = useState("")
  const [problemError, setProblemError] = useState<string | null>(null)

  function handleStatusChange(
    rideId: string,
    newStatus: Enums<"ride_status">
  ): void {
    // Require confirmation for "completed"
    if (newStatus === "completed") {
      setConfirmRideId(rideId)
      setConfirmStatus(newStatus)
      return
    }

    executeStatusChange(rideId, newStatus)
  }

  function executeStatusChange(
    rideId: string,
    newStatus: Enums<"ride_status">
  ): void {
    startTransition(async () => {
      const result = await updateRideStatus(rideId, newStatus)
      if (!result.success) {
        // Show error as alert for touch-device drivers
        alert(result.error ?? "Statusaenderung fehlgeschlagen")
      } else {
        router.refresh()
      }
    })
  }

  function handleConfirmComplete(): void {
    if (confirmRideId && confirmStatus) {
      executeStatusChange(confirmRideId, confirmStatus)
    }
    setConfirmRideId(null)
    setConfirmStatus(null)
  }

  function handleCancelComplete(): void {
    setConfirmRideId(null)
    setConfirmStatus(null)
  }

  function handleReportProblem(rideId: string): void {
    setProblemRideId(rideId)
    setProblemText("")
    setProblemError(null)
  }

  function handleSubmitProblem(): void {
    if (!problemRideId) return
    const text = problemText.trim()
    if (text.length === 0) {
      setProblemError("Bitte beschreiben Sie das Problem.")
      return
    }

    startTransition(async () => {
      const result = await reportRideProblem(problemRideId!, text)
      if (!result.success) {
        setProblemError(result.error ?? "Senden fehlgeschlagen")
      } else {
        setProblemRideId(null)
        setProblemText("")
        setProblemError(null)
      }
    })
  }

  if (rides.length === 0) {
    return <EmptyState message="Keine Fahrten fuer diesen Tag." />
  }

  return (
    <>
      <div className="space-y-4">
        {rides.map((ride) => {
          const transitions = getValidTransitionsForRole(ride.status, "driver")
          // Separate primary actions from destructive ones
          const primaryTransitions = transitions.filter(
            (t) => t !== "no_show" && t !== "rejected"
          )
          const destructiveTransitions = transitions.filter(
            (t) => t === "no_show" || t === "rejected"
          )

          return (
            <Card
              key={ride.id}
              className={cn(
                "border-l-[5px]",
                RIDE_STATUS_BORDER_COLORS[ride.status]
              )}
            >
              <CardContent className="p-4">
                {/* Time + Status Badge */}
                <div className="flex items-start justify-between">
                  <span className="text-3xl font-bold tabular-nums">
                    {ride.pickup_time.slice(0, 5)}
                  </span>
                  <RideStatusBadge status={ride.status} />
                </div>

                {/* Ride info */}
                <div className="mt-2 space-y-1">
                  <p className="text-sm font-medium">
                    {ride.patient_last_name}, {ride.patient_first_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {ride.destination_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {RIDE_DIRECTION_LABELS[ride.direction]}
                  </p>
                </div>

                {/* Progress indicator */}
                <RideProgressBar status={ride.status} />

                {/* Google Maps navigation link */}
                {ride.destination_address && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(ride.destination_address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 flex h-11 items-center justify-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-4 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                  >
                    <Navigation className="h-4 w-4" />
                    Navigation starten
                  </a>
                )}

                {/* Notes */}
                {ride.notes && (
                  <div className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                    {ride.notes}
                  </div>
                )}

                {/* Details link */}
                <Button
                  variant="link"
                  size="sm"
                  className="mt-1 h-auto p-0 text-xs"
                  asChild
                >
                  <Link href={`/rides/${ride.id}`}>Details anzeigen</Link>
                </Button>

                {/* PRIMARY action buttons (large, colored, touch-friendly) */}
                {primaryTransitions.length > 0 && (
                  <div className="mt-4 flex flex-col gap-2">
                    {primaryTransitions.map((targetStatus) => (
                      <Button
                        key={targetStatus}
                        disabled={isPending}
                        onClick={() =>
                          handleStatusChange(ride.id, targetStatus)
                        }
                        className={cn(
                          "h-14 w-full text-lg font-semibold shadow-sm",
                          DRIVER_ACTION_COLORS[targetStatus] ??
                            "bg-primary text-primary-foreground hover:bg-primary/90"
                        )}
                      >
                        {DRIVER_ACTION_LABELS[targetStatus] ??
                          RIDE_STATUS_LABELS[targetStatus]}
                      </Button>
                    ))}
                  </div>
                )}

                {/* DESTRUCTIVE actions (smaller, outline) */}
                {destructiveTransitions.length > 0 && (
                  <div className="mt-2 flex flex-col gap-2">
                    {destructiveTransitions.map((targetStatus) => (
                      <Button
                        key={targetStatus}
                        variant="outline"
                        disabled={isPending}
                        onClick={() =>
                          handleStatusChange(ride.id, targetStatus)
                        }
                        className="h-12 w-full border-red-300 text-base font-semibold text-red-700 hover:bg-red-50"
                      >
                        {DRIVER_ACTION_LABELS[targetStatus] ??
                          RIDE_STATUS_LABELS[targetStatus]}
                      </Button>
                    ))}
                  </div>
                )}

                {/* "Problem melden" button -- always shown for non-terminal rides */}
                {transitions.length > 0 && (
                  <Button
                    variant="ghost"
                    disabled={isPending}
                    onClick={() => handleReportProblem(ride.id)}
                    className="mt-2 h-10 w-full text-sm text-muted-foreground"
                  >
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Problem melden
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Confirmation dialog for "Fahrt abgeschlossen" */}
      <AlertDialog
        open={confirmRideId !== null}
        onOpenChange={(open) => {
          if (!open) handleCancelComplete()
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fahrt abschliessen?</AlertDialogTitle>
            <AlertDialogDescription>
              Sind Sie sicher, dass Sie diese Fahrt als abgeschlossen markieren
              moechten? Diese Aktion kann nicht rueckgaengig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelComplete}>
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmComplete}
              className="bg-green-600 hover:bg-green-700"
            >
              Ja, abschliessen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* "Problem melden" dialog */}
      <Dialog
        open={problemRideId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setProblemRideId(null)
            setProblemText("")
            setProblemError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Problem melden</DialogTitle>
            <DialogDescription>
              Beschreiben Sie das Problem. Die Disposition wird benachrichtigt.
              Der Fahrtstatus wird nicht geaendert.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={problemText}
            onChange={(e) => {
              setProblemText(e.target.value)
              setProblemError(null)
            }}
            placeholder="Was ist passiert?"
            rows={4}
            className="text-base"
          />
          {problemError && (
            <p className="text-sm text-red-600">{problemError}</p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setProblemRideId(null)
                setProblemText("")
                setProblemError(null)
              }}
            >
              Abbrechen
            </Button>
            <Button
              disabled={isPending}
              onClick={handleSubmitProblem}
            >
              Absenden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ---------------------------------------------------------------------------
// Progress bar sub-component
// ---------------------------------------------------------------------------

interface RideProgressBarProps {
  status: Enums<"ride_status">
}

/** Determine the index of the current status within the progress steps. Returns -1 for non-progress statuses. */
function getProgressIndex(status: Enums<"ride_status">): number {
  return DRIVER_PROGRESS_STEPS.findIndex((s) => s.status === status)
}

function RideProgressBar({ status }: RideProgressBarProps) {
  const currentIndex = getProgressIndex(status)

  // Don't show progress for statuses outside the normal flow (cancelled, rejected, no_show, unplanned)
  if (currentIndex < 0) return null

  return (
    <div className="mt-3">
      {/* Dots + connecting line */}
      <div className="flex items-center justify-between">
        {DRIVER_PROGRESS_STEPS.map((step, i) => {
          const isCompleted = i < currentIndex
          const isCurrent = i === currentIndex
          const dotColor =
            isCompleted || isCurrent
              ? RIDE_STATUS_DOT_COLORS[step.status]
              : "bg-gray-200"

          return (
            <div key={step.status} className="flex flex-1 items-center">
              {/* Dot */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "h-3 w-3 rounded-full border-2 transition-colors",
                    isCurrent && "ring-2 ring-offset-1",
                    isCurrent
                      ? `ring-current ${dotColor} border-transparent`
                      : "",
                    isCompleted ? `${dotColor} border-transparent` : "",
                    !isCompleted && !isCurrent
                      ? "border-gray-300 bg-white"
                      : ""
                  )}
                />
              </div>
              {/* Connecting line (not after last dot) */}
              {i < DRIVER_PROGRESS_STEPS.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 flex-1",
                    i < currentIndex ? "bg-green-400" : "bg-gray-200"
                  )}
                />
              )}
            </div>
          )
        })}
      </div>
      {/* Labels */}
      <div className="mt-1 flex justify-between">
        {DRIVER_PROGRESS_STEPS.map((step, i) => {
          const isCurrent = i === currentIndex
          return (
            <span
              key={step.status}
              className={cn(
                "text-center text-[10px] leading-tight",
                isCurrent
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground"
              )}
              style={{ width: `${100 / DRIVER_PROGRESS_STEPS.length}%` }}
            >
              {step.label}
            </span>
          )
        })}
      </div>
    </div>
  )
}
