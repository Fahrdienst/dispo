import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/require-auth"
import { PageHeader } from "@/components/dashboard/page-header"
import { Button } from "@/components/ui/button"
import { MyRidesList } from "@/components/my-rides/my-rides-list"

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

  const { data: rides } = await supabase
    .from("rides")
    .select("id, pickup_time, date, status, direction, notes, patients(first_name, last_name), destinations(display_name)")
    .eq("driver_id", auth.driverId)
    .eq("date", selectedDate)
    .eq("is_active", true)
    .order("pickup_time")

  const mappedRides = (rides ?? []).map((ride) => {
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

      <MyRidesList rides={mappedRides} />
    </div>
  )
}
