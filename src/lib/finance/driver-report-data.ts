/**
 * Driver report — server-side data fetching (Issue #153, M14 Phase 14.3).
 *
 * All aggregation happens server-side and only the aggregated result (plus an
 * on-screen drill-down) is returned. RLS on `rides` plus the `/finance` layout
 * gate (admin+operator) protect the raw data; nothing beyond the displayed
 * figures is handed to the client (SEC-M14-007).
 */

import { createClient } from "@/lib/supabase/server"
import {
  aggregateDriverReport,
  type CompensationRates,
  type DriverReportResult,
  type NormalizedRide,
} from "@/lib/finance/driver-report"

/** Full report payload for the page + export. */
export interface DriverReport extends DriverReportResult {
  rates: CompensationRates
}

interface GetDriverReportParams {
  dateFrom: string
  dateTo: string
}

/** Shape of the joined ride row we select (drivers/destinations may be null). */
interface RideJoinRow {
  id: string
  date: string
  driver_id: string | null
  distance_meters: number | null
  duration_seconds: number | null
  calculated_price: number | null
  price_override: number | null
  drivers: { first_name: string; last_name: string } | null
  destinations: { display_name: string } | null
}

const EMPTY_RESULT: DriverReport = {
  rows: [],
  details: {},
  summary: {
    driverCount: 0,
    totalRides: 0,
    totalKm: 0,
    totalDurationSeconds: 0,
    totalRevenue: 0,
    totalCompensation: 0,
    ridesWithoutKm: 0,
    ridesWithoutPrice: 0,
  },
  rates: { perRideChf: null, perKmChf: null },
}

/**
 * Fetch the current organization compensation rates. Returns nulls (→ CHF 0 in
 * the formula) if settings are missing or the feature is unconfigured.
 */
async function getCompensationRates(): Promise<CompensationRates> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("organization_settings")
    .select("driver_comp_per_ride_chf, driver_comp_per_km_chf")
    .limit(1)
    .single()

  if (error || !data) {
    return { perRideChf: null, perKmChf: null }
  }

  return {
    perRideChf: data.driver_comp_per_ride_chf,
    perKmChf: data.driver_comp_per_km_chf,
  }
}

/**
 * Build the per-driver report for a date range. Only `completed` rides with an
 * assigned driver count toward the report (concept 5). Revenue = Σ effective
 * price (COALESCE(price_override, calculated_price)) since cash is collected by
 * the driver → revenue equals cash collected (Kassenabgleich).
 */
export async function getDriverReport(
  params: GetDriverReportParams
): Promise<DriverReport> {
  const supabase = await createClient()

  const rates = await getCompensationRates()

  const { data, error } = await supabase
    .from("rides")
    .select(
      "id, date, driver_id, distance_meters, duration_seconds, calculated_price, price_override, drivers(first_name, last_name), destinations(display_name)"
    )
    .eq("is_active", true)
    .eq("status", "completed")
    .not("driver_id", "is", null)
    .gte("date", params.dateFrom)
    .lte("date", params.dateTo)
    .order("date")
    .order("pickup_time")

  if (error) {
    console.error("Failed to fetch driver report data:", error.message)
    return { ...EMPTY_RESULT, rates }
  }

  const normalized: NormalizedRide[] = (
    (data ?? []) as unknown as RideJoinRow[]
  )
    // Guard: driver_id is filtered non-null in SQL, but keep the type narrow.
    .filter((ride): ride is RideJoinRow & { driver_id: string } =>
      ride.driver_id != null
    )
    .map((ride) => {
      const driver = ride.drivers
      const driverName = driver
        ? `${driver.last_name}, ${driver.first_name}`
        : "Unbekannt"
      const price = ride.price_override ?? ride.calculated_price ?? null

      return {
        rideId: ride.id,
        driverId: ride.driver_id,
        driverName,
        date: ride.date,
        destinationName: ride.destinations?.display_name ?? null,
        distanceMeters: ride.distance_meters,
        durationSeconds: ride.duration_seconds,
        price,
      }
    })

  const result = aggregateDriverReport(normalized, rates)

  return { ...result, rates }
}
