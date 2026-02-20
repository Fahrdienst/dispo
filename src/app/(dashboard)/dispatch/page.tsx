import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/require-auth"
import { PageHeader } from "@/components/dashboard/page-header"
import {
  DispatchBoard,
  type DispatchRide,
  type DispatchDriver,
  type DriverAvailabilityMap,
} from "@/components/dispatch/dispatch-board"
import type { Enums } from "@/lib/types/database"

export const metadata: Metadata = {
  title: "Disposition - Dispo",
}

/** Map JS day index (0=Sun) to our day_of_week enum. */
const JS_DAY_TO_ENUM: Record<number, Enums<"day_of_week">> = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
}

function getToday(): string {
  return new Date().toISOString().split("T")[0]!
}

interface DispatchPageProps {
  searchParams: Promise<{ date?: string }>
}

export default async function DispatchPage({ searchParams }: DispatchPageProps) {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    redirect("/login")
  }

  const { date } = await searchParams
  const today = getToday()
  const selectedDate = date ?? today

  // Determine day_of_week for the selected date
  const selectedDateObj = new Date(selectedDate + "T00:00:00")
  const dayOfWeek = JS_DAY_TO_ENUM[selectedDateObj.getDay()]

  const supabase = await createClient()

  // Parallel fetches
  const [ridesResult, driversResult, weeklyAvailResult, dateAvailResult] = await Promise.all([
    // (a) All active rides for the day
    supabase
      .from("rides")
      .select("id, pickup_time, date, status, direction, notes, driver_id, patients(first_name, last_name), destinations(display_name)")
      .eq("date", selectedDate)
      .eq("is_active", true)
      .order("pickup_time"),

    // (b) All active drivers
    supabase
      .from("drivers")
      .select("id, first_name, last_name, vehicle_type")
      .eq("is_active", true)
      .order("last_name"),

    // (c1) Weekly availability for this day of week
    dayOfWeek
      ? supabase
          .from("driver_availability")
          .select("driver_id, start_time")
          .eq("day_of_week", dayOfWeek)
          .is("specific_date", null)
      : Promise.resolve({ data: [] as { driver_id: string; start_time: string }[], error: null }),

    // (c2) Date-specific availability
    supabase
      .from("driver_availability")
      .select("driver_id, start_time")
      .eq("specific_date", selectedDate),
  ])

  // Map rides to display format
  const rides: DispatchRide[] = (ridesResult.data ?? []).map((ride) => {
    const patient = ride.patients as { first_name: string; last_name: string } | null
    const destination = ride.destinations as { display_name: string } | null
    return {
      id: ride.id,
      pickup_time: ride.pickup_time,
      date: ride.date,
      status: ride.status,
      direction: ride.direction,
      notes: ride.notes,
      driver_id: ride.driver_id,
      patient_first_name: patient?.first_name ?? "\u2013",
      patient_last_name: patient?.last_name ?? "\u2013",
      destination_name: destination?.display_name ?? "\u2013",
    }
  })

  // Map drivers
  const drivers: DispatchDriver[] = (driversResult.data ?? []).map((d) => ({
    id: d.id,
    first_name: d.first_name,
    last_name: d.last_name,
    vehicle_type: d.vehicle_type,
  }))

  // Build driver availability map: driverId -> array of slot start times
  // Merge weekly + date-specific (date-specific takes priority but we union for simplicity)
  const availabilityMap: DriverAvailabilityMap = {}
  const allAvailSlots = [
    ...(weeklyAvailResult.data ?? []),
    ...(dateAvailResult.data ?? []),
  ]

  for (const slot of allAvailSlots) {
    const existing = availabilityMap[slot.driver_id] ?? []
    const startTime = slot.start_time.substring(0, 5)
    if (!existing.includes(startTime)) {
      existing.push(startTime)
    }
    availabilityMap[slot.driver_id] = existing
  }

  // Sort each driver's slots
  for (const driverId of Object.keys(availabilityMap)) {
    availabilityMap[driverId]!.sort()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Disposition"
        description={`Tagesuebersicht und Fahrerzuweisung`}
      />
      <DispatchBoard
        rides={rides}
        drivers={drivers}
        driverAvailability={availabilityMap}
        selectedDate={selectedDate}
        today={today}
      />
    </div>
  )
}
