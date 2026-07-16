import type { Metadata } from "next"
import Link from "next/link"
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
import { SplitView } from "@/components/dispatch/split-view"
import type {
  SplitRide,
  SplitDriver,
} from "@/components/dispatch/split-view-types"
import { WeekNav } from "@/components/shared/week-nav"
import { Button } from "@/components/ui/button"
import { type QueueEntry } from "@/components/acceptance/acceptance-queue"
import { AcceptanceQueueWrapper } from "@/components/acceptance/acceptance-queue-wrapper"
import {
  isAcceptanceFlowEnabled,
  ACTIVE_STAGES,
} from "@/lib/acceptance/constants"
import { checkPendingAcceptances } from "@/lib/acceptance/engine"
import { getToday, getMondayOf, getSundayOf } from "@/lib/utils/dates"
import {
  deriveAssignmentStatus,
  deriveAngefragtTiming,
  ASSIGNMENT_RIDE_STATUSES,
} from "@/lib/dispatch/assignment-status"
import { loadDriverSchedules } from "@/lib/availability/assignment"
import {
  resolveDriverDayStatus,
  findAbsenceOn,
} from "@/lib/availability/driver-status"
import type { AcceptanceStage } from "@/lib/acceptance/types"
import { PrintDayButton } from "@/components/dispatch/print-day-button"
import { NewRideButton } from "@/components/rides/new-ride-button"
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
  // #180: gate server-side. Drivers never reach a data render — redirect first.
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    redirect("/login")
  }

  const { date, week } = await searchParams
  const today = getToday()

  // Day view stays reachable via ?date= (existing DispatchBoard, unchanged).
  if (date) {
    return renderDayView(date, today)
  }

  // Default experience: weekly split-view (Fahrten links, Fahrer rechts).
  const weekStart = week ? getMondayOf(week) : getMondayOf(today)
  return renderSplitView(weekStart, today)
}

// ---------------------------------------------------------------------------
// Split-View (M15, #168) — weekly assignment surface
// ---------------------------------------------------------------------------

async function renderSplitView(weekStart: string, today: string) {
  const weekEnd = getSundayOf(weekStart)
  const todayWeekStart = getMondayOf(today)
  const supabase = await createClient()

  // 1) Rides for the week + active drivers, in parallel. Rides are scoped to the
  //    four assignment-relevant statuses (concept §0) so terminal / in-transport
  //    rides never load.
  const [ridesResult, driversResult] = await Promise.all([
    supabase
      .from("rides")
      .select(
        "id, date, pickup_time, status, direction, driver_id, parent_ride_id, requirements, patients(first_name, last_name, city), destinations(display_name)"
      )
      .gte("date", weekStart)
      .lte("date", weekEnd)
      .eq("is_active", true)
      .in("status", [...ASSIGNMENT_RIDE_STATUSES])
      .order("date")
      .order("pickup_time"),

    supabase
      .from("drivers")
      .select("id, first_name, last_name, vehicle_type")
      .eq("is_active", true)
      .order("last_name"),
  ])

  const rawRides = ridesResult.data ?? []
  const rawDrivers = driversResult.data ?? []
  const rideIds = rawRides.map((r) => r.id)
  const driverIds = rawDrivers.map((d) => d.id)

  // 2) Bundled follow-ups — all keyed by the IDs from step 1 (no N+1).
  const [schedules, trackingResult, rejectionResult] = await Promise.all([
    loadDriverSchedules(supabase, driverIds, today),

    rideIds.length > 0
      ? supabase
          .from("acceptance_tracking")
          .select("ride_id, stage, is_short_notice, notified_at")
          .in("ride_id", rideIds)
          .in("stage", [...ACTIVE_STAGES, "timed_out"])
      : Promise.resolve({
          data: [] as {
            ride_id: string
            stage: AcceptanceStage
            is_short_notice: boolean
            notified_at: string
          }[],
        }),

    // Latest decline per ride, for the Abgelehnt cards (assignment_events, #164).
    rideIds.length > 0
      ? supabase
          .from("assignment_events")
          .select("ride_id, driver_id, created_at")
          .eq("event", "rejected")
          .in("ride_id", rideIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({
          data: [] as {
            ride_id: string
            driver_id: string | null
            created_at: string
          }[],
        }),
  ])

  // --- Lookup maps ---

  /** driverId -> "V. Nachname" (compact, as in the concept mockup). */
  const driverNameById = new Map<string, string>()
  for (const d of rawDrivers) {
    driverNameById.set(
      d.id,
      `${d.first_name.charAt(0)}. ${d.last_name}`.trim()
    )
  }

  /** parentRideId -> linked return ride pickup time. */
  const returnByParentId = new Map<string, string>()
  for (const r of rawRides) {
    if (r.parent_ride_id) {
      returnByParentId.set(r.parent_ride_id, r.pickup_time)
    }
  }

  /** rideId -> active acceptance tracking (for the overdue marker). */
  const trackingByRideId = new Map<
    string,
    { stage: AcceptanceStage; is_short_notice: boolean; notified_at: string }
  >()
  for (const t of trackingResult.data ?? []) {
    if (!trackingByRideId.has(t.ride_id)) {
      trackingByRideId.set(t.ride_id, {
        stage: t.stage,
        is_short_notice: t.is_short_notice,
        notified_at: t.notified_at,
      })
    }
  }

  /** rideId -> latest decline (driver + time). Events are desc-ordered. */
  const rejectionByRideId = new Map<
    string,
    { driver_id: string | null; created_at: string }
  >()
  for (const ev of rejectionResult.data ?? []) {
    if (!rejectionByRideId.has(ev.ride_id)) {
      rejectionByRideId.set(ev.ride_id, {
        driver_id: ev.driver_id,
        created_at: ev.created_at,
      })
    }
  }

  const now = new Date()

  // --- Build SplitRide[] ---
  const rides: SplitRide[] = []
  for (const r of rawRides) {
    const assignmentStatus = deriveAssignmentStatus(r.status)
    if (!assignmentStatus) continue // out-of-scope status (defensive; query filters)

    const patient = r.patients as {
      first_name: string
      last_name: string
      city: string | null
    } | null
    const destination = r.destinations as { display_name: string } | null

    const tracking = trackingByRideId.get(r.id) ?? null
    const overdue =
      assignmentStatus === "angefragt"
        ? deriveAngefragtTiming(tracking, now).overdue
        : false

    const rejection = rejectionByRideId.get(r.id)

    rides.push({
      id: r.id,
      date: r.date,
      pickup_time: r.pickup_time,
      status: r.status,
      assignmentStatus,
      direction: r.direction,
      patient_first_name: patient?.first_name ?? "–",
      patient_last_name: patient?.last_name ?? "–",
      patient_city: patient?.city ?? null,
      destination_name: destination?.display_name ?? "–",
      requirements: r.requirements ?? [],
      parent_ride_id: r.parent_ride_id,
      assigned_driver_name: r.driver_id
        ? driverNameById.get(r.driver_id) ?? null
        : null,
      linked_return_time: returnByParentId.get(r.id) ?? null,
      overdue,
      rejected_by_name:
        assignmentStatus === "abgelehnt" && rejection?.driver_id
          ? driverNameById.get(rejection.driver_id) ?? null
          : null,
      rejected_at:
        assignmentStatus === "abgelehnt" ? rejection?.created_at ?? null : null,
    })
  }

  // --- Per-driver ride counts for the period (workload = requested + confirmed) ---
  const periodRideCount = new Map<string, number>()
  for (const r of rawRides) {
    if (!r.driver_id) continue
    const bucket = deriveAssignmentStatus(r.status)
    if (bucket !== "angefragt" && bucket !== "bestaetigt") continue
    periodRideCount.set(r.driver_id, (periodRideCount.get(r.driver_id) ?? 0) + 1)
  }

  // --- Build SplitDriver[] with today's neutral availability (#187) ---
  const scheduleByDriverId = new Map(schedules.map((s) => [s.driverId, s]))
  const drivers: SplitDriver[] = rawDrivers.map((d) => {
    const schedule = scheduleByDriverId.get(d.id)
    const availability = schedule?.availability ?? []
    const absences = schedule?.absences ?? []
    const status = resolveDriverDayStatus(today, null, availability, absences)
    const coveringAbsence = findAbsenceOn(today, absences)

    return {
      id: d.id,
      first_name: d.first_name,
      last_name: d.last_name,
      vehicle_type: d.vehicle_type,
      today_slots: status.windows.map((w) => w.start.slice(0, 5)),
      is_absent_today: status.isAbsent,
      // Neutral: end date only, never the reason (#187).
      absent_until: coveringAbsence?.end_date ?? null,
      period_ride_count: periodRideCount.get(d.id) ?? 0,
    }
  })

  return (
    <div className="-mx-4 mx-auto max-w-none space-y-6 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <PageHeader
        title="Fahrer-Zuteilung"
        description="Fahrten links, Fahrer rechts – Zuteilung pro Woche"
        actions={
          <>
            <NewRideButton defaultDate={today} />
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dispatch?date=${today}`}>Tagesansicht</Link>
            </Button>
          </>
        }
      />

      <WeekNav
        weekStart={weekStart}
        basePath="/dispatch"
        todayWeekStart={todayWeekStart}
      />

      <SplitView rides={rides} drivers={drivers} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Day View (existing DispatchBoard — unchanged, reachable via ?date=)
// ---------------------------------------------------------------------------

async function renderDayView(selectedDate: string, today: string) {
  const selectedDateObj = new Date(selectedDate + "T00:00:00")
  const dayOfWeek = JS_DAY_TO_ENUM[selectedDateObj.getDay()]

  const supabase = await createClient()
  const acceptanceEnabled = isAcceptanceFlowEnabled()

  const [ridesResult, driversResult, weeklyAvailResult, dateAvailResult, absencesResult, trackingResult] = await Promise.all([
    supabase
      .from("rides")
      .select("id, pickup_time, date, status, direction, notes, driver_id, appointment_time, parent_ride_id, duration_seconds, patients(first_name, last_name), destinations(display_name)")
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

    // Approved absences covering the selected day (Issue #104)
    supabase
      .from("driver_absences")
      .select("driver_id")
      .eq("status", "approved")
      .lte("start_date", selectedDate)
      .gte("end_date", selectedDate),

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
      duration_seconds: ride.duration_seconds,
      patient_first_name: patient?.first_name ?? "–",
      patient_last_name: patient?.last_name ?? "–",
      destination_name: destination?.display_name ?? "–",
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

  // Drivers on approved leave for the selected day (Issue #104)
  const absentDriverIds = [
    ...new Set((absencesResult.data ?? []).map((a) => a.driver_id)),
  ]

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
    <div className="-mx-4 mx-auto max-w-none space-y-6 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <PageHeader
        title="Disposition"
        description="Tagesuebersicht und Fahrerzuweisung"
        actions={
          <>
            <NewRideButton defaultDate={selectedDate} />
            <PrintDayButton date={selectedDate} />
          </>
        }
      />

      {queueEntries.length > 0 && (
        <AcceptanceQueueWrapper entries={queueEntries} />
      )}

      <DispatchBoard
        rides={rides}
        drivers={drivers}
        driverAvailability={availabilityMap}
        absentDriverIds={absentDriverIds}
        selectedDate={selectedDate}
        today={today}
      />
    </div>
  )
}
