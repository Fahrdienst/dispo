/**
 * Statistics — server-side data fetching (Issue #155, M14 Phase 14.4).
 *
 * All aggregation happens server-side and only the aggregated result is returned
 * (SEC-M14-007). RLS on `rides` plus the `/finance` layout gate (admin+operator)
 * protect the raw data; nothing beyond the displayed aggregate figures is handed
 * to the client.
 *
 * Only `completed`, active rides in the period are considered (concept 7). The
 * approach is a direct SQL aggregation over the period — no materialized view
 * (ADR-015 E7); at ~26k rides/year the query stays in the low-millisecond range.
 */

import { createClient } from "@/lib/supabase/server"
import {
  aggregateStatistics,
  type NormalizedStatRide,
  type StatDimension,
  type StatisticsResult,
} from "@/lib/finance/statistics"
import type { Database } from "@/lib/types/database"

type RideDirection = Database["public"]["Enums"]["ride_direction"]

interface GetStatisticsParams {
  dateFrom: string
  dateTo: string
  dimension: StatDimension
}

/** Column allowlist for the joined ride rows (no `SELECT *`). */
const RIDE_SELECT =
  "date, direction, distance_meters, distance_source, duration_seconds, " +
  "calculated_price, price_override, tariff_zone, driver_id, destination_id, " +
  "patient_id, drivers(first_name, last_name), destinations(display_name), " +
  "patients(first_name, last_name)"

/** Shape of the joined ride row we select (joined rows may be null). */
interface RideJoinRow {
  date: string
  direction: RideDirection
  distance_meters: number | null
  distance_source: string | null
  duration_seconds: number | null
  calculated_price: number | null
  price_override: number | null
  tariff_zone: string | null
  driver_id: string | null
  destination_id: string
  patient_id: string
  drivers: { first_name: string; last_name: string } | null
  destinations: { display_name: string } | null
  patients: { first_name: string; last_name: string } | null
}

const EMPTY_RESULT = (dimension: StatDimension): StatisticsResult => ({
  dimension,
  rows: [],
  summary: {
    rowCount: 0,
    totalRides: 0,
    totalMeters: 0,
    totalKm: 0,
    backfillKm: 0,
    ridesWithoutKm: 0,
    totalDurationSeconds: 0,
    totalRevenue: 0,
  },
})

/**
 * Fetch and aggregate completed-ride statistics for a period and dimension.
 *
 * Revenue = Σ effective price (COALESCE(price_override, calculated_price)).
 * km      = Σ distance_meters, with the non-`planned` share tracked separately.
 */
export async function getStatistics(
  params: GetStatisticsParams
): Promise<StatisticsResult> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("rides")
    .select(RIDE_SELECT)
    .eq("is_active", true)
    .eq("status", "completed")
    .gte("date", params.dateFrom)
    .lte("date", params.dateTo)
    .order("date")

  if (error) {
    console.error("Failed to fetch statistics data:", error.message)
    return EMPTY_RESULT(params.dimension)
  }

  const normalized: NormalizedStatRide[] = (
    (data ?? []) as unknown as RideJoinRow[]
  ).map((r) => {
    const driver = r.drivers
    const driverName = driver ? `${driver.last_name}, ${driver.first_name}` : null
    const patient = r.patients
    const patientName = patient
      ? `${patient.last_name}, ${patient.first_name}`
      : null

    return {
      date: r.date,
      driverId: r.driver_id,
      driverName,
      destinationId: r.destination_id,
      destinationName: r.destinations?.display_name ?? null,
      patientId: r.patient_id,
      patientName,
      tariffZone: r.tariff_zone,
      direction: r.direction,
      distanceMeters: r.distance_meters,
      distanceSource: r.distance_source ?? "planned",
      durationSeconds: r.duration_seconds,
      price: r.price_override ?? r.calculated_price ?? null,
    }
  })

  return aggregateStatistics(normalized, params.dimension)
}
