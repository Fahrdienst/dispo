import { createClient } from "@/lib/supabase/server"
import { RIDE_STATUS_LABELS, RIDE_DIRECTION_LABELS } from "@/lib/rides/constants"
import type { Enums } from "@/lib/types/database"

// =============================================================================
// Types
// =============================================================================

/** Single row in the billing CSV export */
export interface BillingExportRow {
  ride_id: string
  date: string
  pickup_time: string
  patient_name: string
  destination_name: string
  direction: string
  status: string
  driver_name: string | null
  patient_postal_code: string | null
  destination_postal_code: string | null
  from_zone: string | null
  to_zone: string | null
  distance_km: string
  duration_min: string
  calculated_price: string | null
  price_override: string | null
  price_override_reason: string | null
  effective_price: string | null
  fare_version: string | null
}

/** Plausibility summary for the billing overview */
export interface BillingSummary {
  totalRides: number
  totalRevenue: number
  overrideCount: number
  overrideRevenue: number
  missingPriceCount: number
  missingZoneCount: number
}

// =============================================================================
// Data Fetching
// =============================================================================

interface GetBillingDataParams {
  dateFrom: string
  dateTo: string
  status?: Enums<"ride_status">[]
}

/**
 * Fetch all ride data needed for billing export within a date range.
 * Joins patients, destinations, drivers, fare_rules, fare_versions, and zones.
 */
export async function getBillingData(
  params: GetBillingDataParams
): Promise<{ rows: BillingExportRow[]; summary: BillingSummary }> {
  const supabase = await createClient()

  let query = supabase
    .from("rides")
    .select(
      "id, date, pickup_time, direction, status, notes, distance_meters, duration_seconds, calculated_price, price_override, price_override_reason, fare_rule_id, patients(first_name, last_name, postal_code), destinations(display_name, postal_code), drivers(first_name, last_name), fare_rules(fare_versions(name), from_zone:zones!fare_rules_from_zone_id_fkey(name), to_zone:zones!fare_rules_to_zone_id_fkey(name))"
    )
    .eq("is_active", true)
    .gte("date", params.dateFrom)
    .lte("date", params.dateTo)
    .order("date")
    .order("pickup_time")

  if (params.status && params.status.length > 0) {
    query = query.in("status", params.status)
  }

  const { data, error } = await query

  if (error) {
    console.error("Failed to fetch billing data:", error.message)
    return {
      rows: [],
      summary: {
        totalRides: 0,
        totalRevenue: 0,
        overrideCount: 0,
        overrideRevenue: 0,
        missingPriceCount: 0,
        missingZoneCount: 0,
      },
    }
  }

  let totalRevenue = 0
  let overrideCount = 0
  let overrideRevenue = 0
  let missingPriceCount = 0
  let missingZoneCount = 0

  const rows: BillingExportRow[] = (data ?? []).map((ride) => {
    const patient = ride.patients as {
      first_name: string
      last_name: string
      postal_code: string | null
    } | null
    const destination = ride.destinations as {
      display_name: string
      postal_code: string | null
    } | null
    const driver = ride.drivers as {
      first_name: string
      last_name: string
    } | null
    const fareRule = ride.fare_rules as {
      fare_versions: { name: string } | null
      from_zone: { name: string } | null
      to_zone: { name: string } | null
    } | null

    const distanceKm =
      ride.distance_meters != null
        ? (ride.distance_meters / 1000).toFixed(1)
        : ""
    const durationMin =
      ride.duration_seconds != null
        ? Math.round(ride.duration_seconds / 60).toString()
        : ""

    const effectivePrice =
      ride.price_override ?? ride.calculated_price ?? null

    // Plausibility tracking
    if (effectivePrice != null) {
      totalRevenue += effectivePrice
    } else {
      missingPriceCount++
    }

    if (ride.price_override != null) {
      overrideCount++
      overrideRevenue += ride.price_override
    }

    if (!fareRule?.from_zone || !fareRule?.to_zone) {
      missingZoneCount++
    }

    return {
      ride_id: ride.id,
      date: ride.date,
      pickup_time: ride.pickup_time.substring(0, 5),
      patient_name: patient
        ? `${patient.last_name}, ${patient.first_name}`
        : "\u2013",
      destination_name: destination?.display_name ?? "\u2013",
      direction: RIDE_DIRECTION_LABELS[ride.direction] ?? ride.direction,
      status: RIDE_STATUS_LABELS[ride.status] ?? ride.status,
      driver_name: driver
        ? `${driver.last_name}, ${driver.first_name}`
        : null,
      patient_postal_code: patient?.postal_code ?? null,
      destination_postal_code: destination?.postal_code ?? null,
      from_zone: fareRule?.from_zone?.name ?? null,
      to_zone: fareRule?.to_zone?.name ?? null,
      distance_km: distanceKm,
      duration_min: durationMin,
      calculated_price:
        ride.calculated_price != null
          ? ride.calculated_price.toFixed(2)
          : null,
      price_override:
        ride.price_override != null
          ? ride.price_override.toFixed(2)
          : null,
      price_override_reason: ride.price_override_reason,
      effective_price:
        effectivePrice != null ? effectivePrice.toFixed(2) : null,
      fare_version: fareRule?.fare_versions?.name ?? null,
    }
  })

  const summary: BillingSummary = {
    totalRides: rows.length,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    overrideCount,
    overrideRevenue: Math.round(overrideRevenue * 100) / 100,
    missingPriceCount,
    missingZoneCount,
  }

  return { rows, summary }
}

// =============================================================================
// CSV Formatting
// =============================================================================

const CSV_HEADERS = [
  "ride_id",
  "date",
  "pickup_time",
  "patient_name",
  "destination_name",
  "direction",
  "status",
  "driver_name",
  "patient_postal_code",
  "destination_postal_code",
  "from_zone",
  "to_zone",
  "distance_km",
  "duration_min",
  "calculated_price",
  "price_override",
  "price_override_reason",
  "effective_price",
  "fare_version",
] as const

/**
 * Escape a CSV field value for semicolon-separated format.
 * Wraps in quotes if the value contains semicolons, quotes, or newlines.
 */
function escapeCsvField(value: string | null): string {
  if (value == null) return ""
  if (
    value.includes(";") ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Format billing rows as a semicolon-separated CSV string with UTF-8 BOM.
 * Uses semicolons as separator (CH/DE standard for Excel compatibility).
 */
export function formatBillingCsv(rows: BillingExportRow[]): string {
  const BOM = "\uFEFF"
  const header = CSV_HEADERS.join(";")

  const lines = rows.map((row) =>
    CSV_HEADERS.map((key) => escapeCsvField(row[key])).join(";")
  )

  return BOM + header + "\n" + lines.join("\n") + "\n"
}
