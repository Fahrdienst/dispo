"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AcceptanceStageBadge } from "@/components/acceptance/acceptance-stage-badge"
import { RejectionDialog } from "@/components/acceptance/rejection-dialog"
import { confirmAssignment } from "@/actions/acceptance"
import { RIDE_DIRECTION_LABELS } from "@/lib/rides/constants"
import type { AcceptanceStage } from "@/lib/acceptance/types"
import type { Enums } from "@/lib/types/database"

export interface PendingAssignment {
  ride_id: string
  pickup_time: string
  date: string
  direction: Enums<"ride_direction">
  stage: AcceptanceStage
  patient_first_name: string
  patient_last_name: string
  destination_name: string
}

interface PendingAssignmentsProps {
  assignments: PendingAssignment[]
}

export function PendingAssignments({ assignments }: PendingAssignmentsProps) {
  const [rejectingRideId, setRejectingRideId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  if (assignments.length === 0) return null

  function handleConfirm(rideId: string) {
    startTransition(async () => {
      const result = await confirmAssignment(rideId)
      if (result.success) {
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">
        Offene Zuweisungen ({assignments.length})
      </h2>

      {assignments.map((a) => (
        <Card
          key={a.ride_id}
          className="border-l-[5px] border-l-amber-400"
        >
          <CardContent className="p-4">
            {/* Time + Stage Badge */}
            <div className="flex items-start justify-between">
              <span className="text-3xl font-bold tabular-nums">
                {a.pickup_time.slice(0, 5)}
              </span>
              <AcceptanceStageBadge stage={a.stage} />
            </div>

            {/* Ride info */}
            <div className="mt-2 space-y-1">
              <p className="text-sm font-medium">
                {a.patient_last_name}, {a.patient_first_name}
              </p>
              <p className="text-sm text-muted-foreground">
                {a.destination_name}
              </p>
              <p className="text-xs text-muted-foreground">
                {RIDE_DIRECTION_LABELS[a.direction]}
              </p>
            </div>

            {/* Action buttons */}
            <div className="mt-4 flex gap-2">
              <Button
                size="lg"
                className="flex-1 bg-green-600 text-base font-semibold hover:bg-green-700"
                disabled={isPending}
                onClick={() => handleConfirm(a.ride_id)}
              >
                Annehmen
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="flex-1 border-red-300 text-base font-semibold text-red-700 hover:bg-red-50"
                disabled={isPending}
                onClick={() => setRejectingRideId(a.ride_id)}
              >
                Ablehnen
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Rejection dialog */}
      {rejectingRideId && (
        <RejectionDialog
          rideId={rejectingRideId}
          open={!!rejectingRideId}
          onOpenChange={(open) => {
            if (!open) setRejectingRideId(null)
          }}
        />
      )}
    </div>
  )
}
