"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { MapPin, User, ExternalLink, Pencil } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { RideStatusBadge } from "@/components/shared/ride-status-badge"
import {
  RIDE_DIRECTION_LABELS,
  IMPAIRMENT_TYPE_LABELS,
} from "@/lib/rides/constants"
import { getRideQuickDetails, type RideQuickDetails } from "@/actions/rides"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RideQuickSheetProps {
  rideId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: RideQuickDetails }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(time: string): string {
  return time.substring(0, 5)
}

function formatDateDE(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00")
  return date.toLocaleDateString("de-CH", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function formatAddress(addr: {
  street: string | null
  house_number: string | null
  postal_code: string | null
  city: string | null
}): string {
  const parts: string[] = []
  if (addr.street) {
    parts.push(
      addr.house_number ? `${addr.street} ${addr.house_number}` : addr.street
    )
  }
  if (addr.postal_code || addr.city) {
    parts.push([addr.postal_code, addr.city].filter(Boolean).join(" "))
  }
  return parts.join(", ") || "Keine Adresse"
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RideQuickSheet({
  rideId,
  open,
  onOpenChange,
}: RideQuickSheetProps) {
  const [state, setState] = useState<LoadState>({ status: "idle" })
  const [, startTransition] = useTransition()

  // Load ride details when rideId changes and sheet is open
  useEffect(() => {
    if (!rideId || !open) {
      return
    }

    setState({ status: "loading" })

    startTransition(async () => {
      const result = await getRideQuickDetails(rideId)
      if (result.success) {
        setState({ status: "success", data: result.data })
      } else {
        setState({ status: "error", message: result.error ?? "Unbekannter Fehler" })
      }
    })
  }, [rideId, open])

  // Reset state when sheet closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setState({ status: "idle" })
    }
    onOpenChange(isOpen)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        {state.status === "loading" && <LoadingSkeleton />}
        {state.status === "error" && <ErrorDisplay message={state.message} />}
        {state.status === "success" && (
          <RideDetails data={state.data} />
        )}
        {state.status === "idle" && (
          <>
            <SheetHeader>
              <SheetTitle>Fahrtdetails</SheetTitle>
            </SheetHeader>
            <SheetDescription className="sr-only">
              Schnelluebersicht einer Fahrt
            </SheetDescription>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Sub-Components
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <SheetHeader>
        <SheetTitle>
          <div className="h-6 w-48 animate-pulse rounded bg-muted" />
        </SheetTitle>
        <SheetDescription className="sr-only">Laden...</SheetDescription>
      </SheetHeader>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-4 w-full animate-pulse rounded bg-muted" />
        ))}
      </div>
    </div>
  )
}

function ErrorDisplay({ message }: { message: string }) {
  return (
    <div className="space-y-4">
      <SheetHeader>
        <SheetTitle>Fehler</SheetTitle>
        <SheetDescription className="sr-only">
          Fehler beim Laden der Fahrtdetails
        </SheetDescription>
      </SheetHeader>
      <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
        {message}
      </div>
    </div>
  )
}

function RideDetails({ data }: { data: RideQuickDetails }) {
  const patientName = data.patient
    ? `${data.patient.last_name}, ${data.patient.first_name}`
    : "Unbekannt"

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <span>{patientName}</span>
        </SheetTitle>
        <SheetDescription>
          {formatDateDE(data.date)} &middot; {formatTime(data.pickup_time)} Uhr
          {data.appointment_time && (
            <> &middot; Termin {formatTime(data.appointment_time)}</>
          )}
        </SheetDescription>
      </SheetHeader>

      <Separator className="my-4" />

      {/* Status */}
      <div className="flex items-center gap-3">
        <RideStatusBadge status={data.status} />
        <span className="text-xs text-muted-foreground">
          {RIDE_DIRECTION_LABELS[data.direction]}
        </span>
      </div>

      <Separator className="my-4" />

      {/* Route */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">Route</h4>
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center gap-1 pt-0.5">
            <MapPin className="h-4 w-4 text-green-600" aria-hidden="true" />
            <div className="h-6 w-px bg-border" />
            <MapPin className="h-4 w-4 text-red-600" aria-hidden="true" />
          </div>
          <div className="flex flex-1 flex-col gap-3">
            <div>
              <p className="text-sm font-medium">Abholung</p>
              <p className="text-sm text-muted-foreground">
                {data.patient ? formatAddress(data.patient) : "Keine Adresse"}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">
                {data.destination?.display_name ?? "Ziel"}
              </p>
              <p className="text-sm text-muted-foreground">
                {data.destination
                  ? formatAddress(data.destination)
                  : "Keine Adresse"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <Separator className="my-4" />

      {/* Patient Impairments */}
      {data.impairments.length > 0 && (
        <>
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">
              Beeintraechtigungen
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {data.impairments.map((imp) => (
                <span
                  key={imp}
                  className="inline-flex rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                >
                  {IMPAIRMENT_TYPE_LABELS[imp]}
                </span>
              ))}
            </div>
          </div>
          <Separator className="my-4" />
        </>
      )}

      {/* Driver */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground">Fahrer</h4>
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-sm">
            {data.driver
              ? `${data.driver.last_name}, ${data.driver.first_name}`
              : "Kein Fahrer zugewiesen"}
          </span>
        </div>
      </div>

      {/* Notes */}
      {data.notes && (
        <>
          <Separator className="my-4" />
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">
              Notizen
            </h4>
            <p className="text-sm">{data.notes}</p>
          </div>
        </>
      )}

      {/* Footer Actions */}
      <div className="mt-auto pt-6">
        <Separator className="mb-4" />
        <SheetFooter className="flex-row gap-2 sm:justify-start">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/rides/${data.id}`}>
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Details
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/rides/${data.id}/edit`}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Bearbeiten
            </Link>
          </Button>
        </SheetFooter>
      </div>
    </div>
  )
}
