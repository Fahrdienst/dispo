import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/dashboard/page-header"
import { RidesTable } from "@/components/rides/rides-table"
import { RidesDayMap } from "@/components/rides/rides-day-map"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getToday, addDays, formatDateDE, getMondayOf, getSundayOf, getWeekDates } from "@/lib/utils/dates"
import { WeekNav } from "@/components/shared/week-nav"
import { RidesWeekView } from "@/components/rides/rides-week-view"
import type { Enums } from "@/lib/types/database"

export const metadata: Metadata = {
  title: "Fahrten - Dispo",
}

interface RidesPageProps {
  searchParams: Promise<{ date?: string; week?: string; driver_id?: string }>
}

export default async function RidesPage({ searchParams }: RidesPageProps) {
  const { date, week, driver_id } = await searchParams
  const today = getToday()

  const supabase = await createClient()

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .single()

  const userRole: Enums<"user_role"> = profile?.role ?? "driver"
  const isStaff = userRole === "admin" || userRole === "operator"

  // Resolve driver name for filter banner
  let driverFilterName: string | null = null
  if (driver_id) {
    const { data: driverData } = await supabase
      .from("drivers")
      .select("first_name, last_name")
      .eq("id", driver_id)
      .single()
    if (driverData) {
      driverFilterName = `${driverData.last_name}, ${driverData.first_name}`
    }
  }

  // --- DAY VIEW (when ?date= param is present) ---
  if (date) {
    const selectedDate = date
    const prevDate = addDays(selectedDate, -1)
    const nextDate = addDays(selectedDate, 1)

    let dayQuery = supabase
      .from("rides")
      .select(
        "*, patients(id, first_name, last_name), destinations(id, display_name), drivers(id, first_name, last_name)"
      )
      .eq("date", selectedDate)
      .order("pickup_time")
    if (driver_id) {
      dayQuery = dayQuery.eq("driver_id", driver_id)
    }
    const { data: rides } = await dayQuery

    const driverParam = driver_id ? `&driver_id=${driver_id}` : ""

    return (
      <div className="space-y-6">
        <PageHeader
          title="Fahrten"
          description="Tagesuebersicht"
          createHref={isStaff ? `/rides/new?date=${selectedDate}` : undefined}
          createLabel="Neue Fahrt"
        />

        {driverFilterName && (
          <div className="flex items-center justify-between rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800">
            <span>Gefiltert nach Fahrer: <strong>{driverFilterName}</strong></span>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/rides?date=${date}`}>Filter entfernen</Link>
            </Button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/rides?date=${prevDate}${driverParam}`}>
              &larr; Vorheriger Tag
            </Link>
          </Button>
          <span className="px-3 text-sm font-medium">
            {formatDateDE(selectedDate)}
          </span>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/rides?date=${nextDate}${driverParam}`}>
              Naechster Tag &rarr;
            </Link>
          </Button>
          {selectedDate !== today && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/rides${driverParam ? `?${driverParam.slice(1)}` : ""}`}>Heute</Link>
            </Button>
          )}
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/rides?week=${getMondayOf(selectedDate)}${driverParam}`}>
              Wochenansicht
            </Link>
          </Button>
        </div>

        <Suspense fallback={<Skeleton className="h-[280px] w-full rounded-lg sm:h-[400px]" />}>
          <RidesDayMap date={selectedDate} />
        </Suspense>

        <RidesTable rides={rides ?? []} userRole={userRole} />
      </div>
    )
  }

  // --- WEEK VIEW (default) ---
  const weekStart = week ? getMondayOf(week) : getMondayOf(today)
  const weekEnd = getSundayOf(weekStart)
  const todayWeekStart = getMondayOf(today)
  const weekDates = getWeekDates(weekStart)

  let weekQuery = supabase
    .from("rides")
    .select("id, date, pickup_time, status, patients(first_name, last_name)")
    .gte("date", weekStart)
    .lte("date", weekEnd)
    .eq("is_active", true)
    .order("date")
    .order("pickup_time")
  if (driver_id) {
    weekQuery = weekQuery.eq("driver_id", driver_id)
  }
  const { data: weekRides } = await weekQuery

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

      {driverFilterName && (
        <div className="flex items-center justify-between rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800">
          <span>Gefiltert nach Fahrer: <strong>{driverFilterName}</strong></span>
          <Button variant="ghost" size="sm" asChild>
            <Link href={week ? `/rides?week=${week}` : "/rides"}>Filter entfernen</Link>
          </Button>
        </div>
      )}

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
