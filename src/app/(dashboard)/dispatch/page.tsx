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
import { DispatchWeekView } from "@/components/dispatch/dispatch-week-view"
import { WeekNav } from "@/components/shared/week-nav"
import {
  AcceptanceQueue,
  type QueueEntry,
} from "@/components/acceptance/acceptance-queue"
import {
  isAcceptanceFlowEnabled,
  ACTIVE_STAGES,
} from "@/lib/acceptance/constants"
import { checkPendingAcceptances } from "@/lib/acceptance/engine"
import { getToday, getMondayOf, getSundayOf, getWeekDates } from "@/lib/utils/dates"
import type { AcceptanceStage } from "@/lib/acceptance/types"
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

interface DispatchPageProps {
  searchParams: Promise<{ date?: string; week?: string }>
}

export default async function DispatchPage({ searchParams }: DispatchPageProps) {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    redirect("/login")
  }

  const { date, week } = await searchParams
  const today = getToday()

  // --- DAY VIEW (when ?date= param is present) ---
  if (date) {
    return renderDayView(date, today)
  }

  // --- WEEK VIEW (default) ---
  const weekStart = week ? getMondayOf(week) : getMondayOf(today)
  const weekEnd = getSundayOf(weekStart)
  const todayWeekStart = getMondayOf(today)
  const weekDates = getWeekDates(weekStart)

  const supabase = await createClient()

  const { data: weekRides } = await supabase
    .from("rides")
    .select(
      "id, date, pickup_time, status, driver_id, patients(first_name, last_name), drivers(last_name)"
    )
    .gte("date", weekStart)
    .lte("date", weekEnd)
    .eq("is_active", true)
    .order("date")
    .order("pickup_time")

  // Group rides by date
  type DispatchWeekRide = {
    id: string
    date: string
    pickup_time: string
    status: Enums<"ride_status">
    driver_id: string | null
    driver_last_name: string | null
    patient_last_name: string
    patient_first_name: string
  }

  const ridesByDate = new Map<string, DispatchWeekRide[]>()
  for (const ride of weekRides ?? []) {
    const patient = ride.patients as { first_name: string; last_name: string } | null
    const driver = ride.drivers as { last_name: string } | null
    const mapped: DispatchWeekRide = {
      id: ride.id,
      date: ride.date,
      pickup_time: ride.pickup_time,
      status: ride.status,
      driver_id: ride.driver_id,
      driver_last_name: driver?.last_name ?? null,
      patient_last_name: patient?.last_name ?? "\u2013",
      patient_first_name: patient?.first_name ?? "\u2013",
    }
    const existing = ridesByDate.get(ride.date) ?? []
    existing.push(mapped)
    ridesByDate.set(ride.date, existing)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Disposition"
        description="Wochenuebersicht"
      />

      <WeekNav
        weekStart={weekStart}
        basePath="/dispatch"
        todayWeekStart={todayWeekStart}
      />

      <DispatchWeekView
        weekDates={weekDates}
        ridesByDate={ridesByDate}
        today={today}
      />
    </div>
  )
}

// --- Day View (extracted for clarity) ---

async function renderDayView(selectedDate: string, today: string) {
  const selectedDateObj = new Date(selectedDate + "T00:00:00")
  const dayOfWeek = JS_DAY_TO_ENUM[selectedDateObj.getDay()]

  const supabase = await createClient()
  const acceptanceEnabled = isAcceptanceFlowEnabled()

  const [ridesResult, driversResult, weeklyAvailResult, dateAvailResult, trackingResult] = await Promise.all([
    supabase
      .from("rides")
      .select("id, pickup_time, date, status, direction, notes, driver_id, appointment_time, parent_ride_id, patients(first_name, last_name), destinations(display_name)")
      .eq("date", selectedDate)
      .eq("is_active", true)
      .order("pickup_time"),

    supabase
      .from("drivers")
      .select("id, first_name, last_name, vehicle_type")
      .eq("is_active", true)
      .order("last_name"),

    dayOfWeek
      ? supabase
          .from("driver_availability")
          .select("driver_id, start_time")
          .eq("day_of_week", dayOfWeek)
          .is("specific_date", null)
      : Promise.resolve({ data: [] as { driver_id: string; start_time: string }[], error: null }),

    supabase
      .from("driver_availability")
      .select("driver_id, start_time")
      .eq("specific_date", selectedDate),

    acceptanceEnabled
      ? supabase
          .from("acceptance_tracking")
          .select(`
            id, ride_id, driver_id, stage, notified_at, rejection_reason_code, rejection_reason_text,
            drivers!inner(first_name, last_name),
            rides!inner(id, pickup_time, date, direction, patients!inner(first_name, last_name), destinations!inner(display_name))
          `)
          .in("stage", [...ACTIVE_STAGES, "timed_out", "rejected"])
      : Promise.resolve({ data: null }),
  ])

  if (acceptanceEnabled) {
    checkPendingAcceptances().catch(console.error)
  }

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
      appointment_time: ride.appointment_time,
      parent_ride_id: ride.parent_ride_id,
      patient_first_name: patient?.first_name ?? "\u2013",
      patient_last_name: patient?.last_name ?? "\u2013",
      destination_name: destination?.display_name ?? "\u2013",
    }
  })

  const drivers: DispatchDriver[] = (driversResult.data ?? []).map((d) => ({
    id: d.id,
    first_name: d.first_name,
    last_name: d.last_name,
    vehicle_type: d.vehicle_type,
  }))

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

  for (const driverId of Object.keys(availabilityMap)) {
    availabilityMap[driverId]!.sort()
  }

  const queueEntries: QueueEntry[] = []
  if (trackingResult.data) {
    for (const tracking of trackingResult.data) {
      const driver = tracking.drivers as unknown as {
        first_name: string
        last_name: string
      }
      const ride = tracking.rides as unknown as {
        id: string
        pickup_time: string
        date: string
        direction: Enums<"ride_direction">
        patients: { first_name: string; last_name: string }
        destinations: { display_name: string }
      }
      if (!driver || !ride) continue

      queueEntries.push({
        tracking_id: tracking.id,
        ride_id: ride.id,
        driver_name: `${driver.first_name} ${driver.last_name}`,
        patient_name: `${ride.patients.first_name} ${ride.patients.last_name}`,
        destination_name: ride.destinations.display_name,
        pickup_time: ride.pickup_time,
        date: ride.date,
        direction: ride.direction,
        stage: tracking.stage as AcceptanceStage,
        notified_at: tracking.notified_at,
        rejection_reason_code: tracking.rejection_reason_code,
        rejection_reason_text: tracking.rejection_reason_text,
      })
    }
  }

  queueEntries.sort((a, b) => a.pickup_time.localeCompare(b.pickup_time))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Disposition"
        description="Tagesuebersicht und Fahrerzuweisung"
      />

      {queueEntries.length > 0 && (
        <AcceptanceQueue entries={queueEntries} />
      )}

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
