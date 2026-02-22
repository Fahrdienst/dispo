import type { Metadata } from "next"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/dashboard/page-header"
import { RidesTable } from "@/components/rides/rides-table"
import { Button } from "@/components/ui/button"
import { getToday, addDays, formatDateDE, getMondayOf, getSundayOf, getWeekDates } from "@/lib/utils/dates"
import { WeekNav } from "@/components/shared/week-nav"
import { RidesWeekView } from "@/components/rides/rides-week-view"
import type { Enums } from "@/lib/types/database"

export const metadata: Metadata = {
  title: "Fahrten - Dispo",
}

interface RidesPageProps {
  searchParams: Promise<{ date?: string; week?: string }>
}

export default async function RidesPage({ searchParams }: RidesPageProps) {
  const { date, week } = await searchParams
  const today = getToday()

  const supabase = await createClient()

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .single()

  const userRole: Enums<"user_role"> = profile?.role ?? "driver"
  const isStaff = userRole === "admin" || userRole === "operator"

  // --- DAY VIEW (when ?date= param is present) ---
  if (date) {
    const selectedDate = date
    const prevDate = addDays(selectedDate, -1)
    const nextDate = addDays(selectedDate, 1)

    const { data: rides } = await supabase
      .from("rides")
      .select(
        "*, patients(id, first_name, last_name), destinations(id, display_name), drivers(id, first_name, last_name)"
      )
      .eq("date", selectedDate)
      .order("pickup_time")

    return (
      <div className="space-y-6">
        <PageHeader
          title="Fahrten"
          description="Tagesuebersicht"
          createHref={isStaff ? `/rides/new?date=${selectedDate}` : undefined}
          createLabel="Neue Fahrt"
        />

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/rides?date=${prevDate}`}>
              &larr; Vorheriger Tag
            </Link>
          </Button>
          <span className="px-3 text-sm font-medium">
            {formatDateDE(selectedDate)}
          </span>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/rides?date=${nextDate}`}>
              Naechster Tag &rarr;
            </Link>
          </Button>
          {selectedDate !== today && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/rides">Heute</Link>
            </Button>
          )}
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/rides?week=${getMondayOf(selectedDate)}`}>
              Wochenansicht
            </Link>
          </Button>
        </div>

        <RidesTable rides={rides ?? []} userRole={userRole} />
      </div>
    )
  }

  // --- WEEK VIEW (default) ---
  const weekStart = week ? getMondayOf(week) : getMondayOf(today)
  const weekEnd = getSundayOf(weekStart)
  const todayWeekStart = getMondayOf(today)
  const weekDates = getWeekDates(weekStart)

  const { data: weekRides } = await supabase
    .from("rides")
    .select("id, date, pickup_time, status, patients(first_name, last_name)")
    .gte("date", weekStart)
    .lte("date", weekEnd)
    .eq("is_active", true)
    .order("date")
    .order("pickup_time")

  // Group rides by date
  type WeekRide = {
    id: string
    date: string
    pickup_time: string
    status: Enums<"ride_status">
    patients: { first_name: string; last_name: string } | null
  }

  const ridesByDate = new Map<string, WeekRide[]>()
  for (const ride of weekRides ?? []) {
    const mapped: WeekRide = {
      id: ride.id,
      date: ride.date,
      pickup_time: ride.pickup_time,
      status: ride.status,
      patients: ride.patients as { first_name: string; last_name: string } | null,
    }
    const existing = ridesByDate.get(ride.date) ?? []
    existing.push(mapped)
    ridesByDate.set(ride.date, existing)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fahrten"
        description="Wochenuebersicht"
        createHref={isStaff ? "/rides/new" : undefined}
        createLabel="Neue Fahrt"
      />

      <WeekNav
        weekStart={weekStart}
        basePath="/rides"
        todayWeekStart={todayWeekStart}
      />

      <RidesWeekView
        weekDates={weekDates}
        ridesByDate={ridesByDate}
        today={today}
        isStaff={isStaff}
      />
    </div>
  )
}
