import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/require-auth"
import { PageHeader } from "@/components/dashboard/page-header"
import { Button } from "@/components/ui/button"
import { MyRidesList } from "@/components/my-rides/my-rides-list"
import {
  PendingAssignments,
  type PendingAssignment,
} from "@/components/my-rides/pending-assignments"
import { isAcceptanceFlowEnabled, ACTIVE_STAGES } from "@/lib/acceptance/constants"
import type { AcceptanceStage } from "@/lib/acceptance/types"
import type { Enums } from "@/lib/types/database"

export const metadata: Metadata = {
  title: "Meine Fahrten - Dispo",
}

function formatDateDE(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00")
  return date.toLocaleDateString("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + "T00:00:00")
  date.setDate(date.getDate() + days)
  return date.toISOString().split("T")[0]!
}

function getToday(): string {
  return new Date().toISOString().split("T")[0]!
}

interface MyRidesPageProps {
  searchParams: Promise<{ date?: string }>
}

export default async function MyRidesPage({ searchParams }: MyRidesPageProps) {
  const auth = await requireAuth(["driver"])
  if (!auth.authorized) {
    redirect("/login")
  }

  if (!auth.driverId) {
    redirect("/login")
  }

  const { date } = await searchParams
  const today = getToday()
  const selectedDate = date ?? today

  const prevDate = addDays(selectedDate, -1)
  const nextDate = addDays(selectedDate, 1)

  const supabase = await createClient()
  const acceptanceEnabled = isAcceptanceFlowEnabled()

  // Parallel fetches: rides for the day + pending acceptance trackings
  const [ridesResult, trackingResult] = await Promise.all([
    supabase
      .from("rides")
      .select("id, pickup_time, date, status, direction, notes, patients(first_name, last_name), destinations(display_name)")
      .eq("driver_id", auth.driverId)
      .eq("date", selectedDate)
      .eq("is_active", true)
      .order("pickup_time"),

    // Fetch active acceptance trackings for this driver (all dates)
    acceptanceEnabled
      ? supabase
          .from("acceptance_tracking")
          .select("ride_id, stage, rides!inner(id, pickup_time, date, direction, patients!inner(first_name, last_name), destinations!inner(display_name))")
          .eq("driver_id", auth.driverId)
          .in("stage", [...ACTIVE_STAGES])
      : Promise.resolve({ data: null }),
  ])

  // Build set of ride IDs that have active tracking (to exclude from normal list)
  const activeTrackingRideIds = new Set<string>()
  const pendingAssignments: PendingAssignment[] = []

  if (trackingResult.data) {
    for (const tracking of trackingResult.data) {
      const ride = tracking.rides as unknown as {
        id: string
        pickup_time: string
        date: string
        direction: Enums<"ride_direction">
        patients: { first_name: string; last_name: string }
        destinations: { display_name: string }
      }
      if (!ride) continue

      activeTrackingRideIds.add(ride.id)
      pendingAssignments.push({
        ride_id: ride.id,
        pickup_time: ride.pickup_time,
        date: ride.date,
        direction: ride.direction,
        stage: tracking.stage as AcceptanceStage,
        patient_first_name: ride.patients.first_name,
        patient_last_name: ride.patients.last_name,
        destination_name: ride.destinations.display_name,
      })
    }
  }

  // Sort pending assignments by pickup_time
  pendingAssignments.sort((a, b) => a.pickup_time.localeCompare(b.pickup_time))

  // Map rides, excluding those with active tracking
  const mappedRides = (ridesResult.data ?? [])
    .filter((ride) => !activeTrackingRideIds.has(ride.id))
    .map((ride) => {
      const patient = ride.patients as { first_name: string; last_name: string } | null
      const destination = ride.destinations as { display_name: string } | null
      return {
        id: ride.id,
        pickup_time: ride.pickup_time,
        date: ride.date,
        status: ride.status,
        direction: ride.direction,
        notes: ride.notes,
        patient_first_name: patient?.first_name ?? "–",
        patient_last_name: patient?.last_name ?? "–",
        destination_name: destination?.display_name ?? "–",
      }
    })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meine Fahrten"
        description={`Ihre zugewiesenen Fahrten fuer ${formatDateDE(selectedDate)}`}
      />

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/my/rides?date=${prevDate}`}>
            &larr; Vorheriger Tag
          </Link>
        </Button>
        <span className="px-3 text-sm font-medium">
          {formatDateDE(selectedDate)}
        </span>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/my/rides?date=${nextDate}`}>
            Naechster Tag &rarr;
          </Link>
        </Button>
        {selectedDate !== today && (
          <Button variant="outline" size="sm" asChild>
            <Link href="/my/rides">Heute</Link>
          </Button>
        )}
      </div>

      {/* Pending assignments section (above regular rides) */}
      {pendingAssignments.length > 0 && (
        <PendingAssignments assignments={pendingAssignments} />
      )}

      <MyRidesList rides={mappedRides} />
    </div>
  )
}
