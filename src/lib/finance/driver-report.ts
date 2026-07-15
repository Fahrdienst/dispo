/**
 * Driver report — pure aggregation and CSV formatting logic (Issue #153, M14 Phase 14.3).
 *
 * This module is intentionally free of any DB / network access so the money math
 * (compensation formula, km rounding, data-quality counting) can be unit-tested in
 * isolation. Data fetching lives in `driver-report-data.ts`.
 *
 * Compensation model (ADR-015, concept 3.3) — deliberately un-versioned and NOT
 * persisted; recomputed live from the current organization settings:
 *
 *   Entschädigung = Fahrten × Pauschale-pro-Fahrt + km × km-Satz
 *
 * A change to the rates therefore changes past reports retroactively.
 *
 * SEC-M14-009: the CSV export is aggregate-only — no patient names, no destination
 * names. Destinations appear only in the on-screen drill-down (`DriverRideDetail`),
 * never in the exported file. The CSV column set below is an explicit allowlist.
 */

// =============================================================================
// Types
// =============================================================================

/** Organization compensation rates (live from organization_settings). */
export interface CompensationRates {
  /** Flat rate per completed ride, CHF. `null` = not configured (treated as 0). */
  perRideChf: number | null
  /** Rate per kilometer, CHF. `null` = not configured (treated as 0). */
  perKmChf: number | null
}

/**
 * A single completed ride, normalized from the DB join. This is the pure input
 * to the aggregation — the caller flattens the Supabase result into this shape.
 */
export interface NormalizedRide {
  rideId: string
  driverId: string
  driverName: string
  date: string
  /** Destination display name — used for the on-screen drill-down only. */
  destinationName: string | null
  distanceMeters: number | null
  durationSeconds: number | null
  /** Effective price: COALESCE(price_override, calculated_price). */
  price: number | null
}

/** A single ride row in the driver drill-down (on-screen only). */
export interface DriverRideDetail {
  rideId: string
  date: string
  destinationName: string | null
  distanceKm: number | null
  price: number | null
}

/** One aggregated row per driver. */
export interface DriverReportRow {
  driverId: string
  driverName: string
  /** Count of completed rides in the period. */
  rideCount: number
  /** Σ distance_meters (raw, for precise downstream use). */
  totalMeters: number
  /** Σ km, rounded to 1 decimal — the figure shown and used for compensation. */
  totalKm: number
  /** Σ duration_seconds (pure ride time patient→destination; excludes approach). */
  totalDurationSeconds: number
  /** Σ effective price (revenue = cash collected). */
  revenue: number
  /** Live compensation: rideCount × perRide + totalKm × perKm. */
  compensation: number
  /** Rides in this driver's set that lack distance data. */
  ridesWithoutKm: number
  /** Rides in this driver's set that lack a price. */
  ridesWithoutPrice: number
}

/** Grand-total summary across all drivers. */
export interface DriverReportSummary {
  driverCount: number
  totalRides: number
  totalKm: number
  totalDurationSeconds: number
  totalRevenue: number
  totalCompensation: number
  ridesWithoutKm: number
  ridesWithoutPrice: number
}

/** Full aggregation result. */
export interface DriverReportResult {
  rows: DriverReportRow[]
  /** Drill-down details keyed by driverId (on-screen only, never exported). */
  details: Record<string, DriverRideDetail[]>
  summary: DriverReportSummary
}

// =============================================================================
// Money / distance helpers
// =============================================================================

/** Round to 2 decimals (CHF), avoiding binary float drift. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/** Convert meters to kilometers, rounded to 1 decimal. */
export function metersToKm(meters: number): number {
  return Math.round((meters / 1000 + Number.EPSILON) * 10) / 10
}

/**
 * Compute a driver's compensation from ride count and rounded km.
 *
 * Pure and total: null rates are treated as CHF 0 (feature simply not configured).
 * Uses the *rounded* km (`metersToKm`) so the figure is reproducible from the
 * km column shown in the table / CSV — no hidden precision.
 */
export function calculateCompensation(
  rideCount: number,
  totalKm: number,
  rates: CompensationRates
): number {
  const perRide = rates.perRideChf ?? 0
  const perKm = rates.perKmChf ?? 0
  return round2(rideCount * perRide + totalKm * perKm)
}

// =============================================================================
// Aggregation
// =============================================================================

/**
 * Aggregate normalized rides into per-driver rows + drill-down details + summary.
 *
 * Drivers appear sorted by name (de-CH collation). Rides with a null driver are
 * ignored by the caller before this point (the report is per-driver).
 */
export function aggregateDriverReport(
  rides: readonly NormalizedRide[],
  rates: CompensationRates
): DriverReportResult {
  interface Acc {
    driverId: string
    driverName: string
    rideCount: number
    totalMeters: number
    totalDurationSeconds: number
    revenue: number
    ridesWithoutKm: number
    ridesWithoutPrice: number
    details: DriverRideDetail[]
  }

  const byDriver = new Map<string, Acc>()

  for (const ride of rides) {
    let acc = byDriver.get(ride.driverId)
    if (!acc) {
      acc = {
        driverId: ride.driverId,
        driverName: ride.driverName,
        rideCount: 0,
        totalMeters: 0,
        totalDurationSeconds: 0,
        revenue: 0,
        ridesWithoutKm: 0,
        ridesWithoutPrice: 0,
        details: [],
      }
      byDriver.set(ride.driverId, acc)
    }

    acc.rideCount += 1

    if (ride.distanceMeters != null) {
      acc.totalMeters += ride.distanceMeters
    } else {
      acc.ridesWithoutKm += 1
    }

    if (ride.durationSeconds != null) {
      acc.totalDurationSeconds += ride.durationSeconds
    }

    if (ride.price != null) {
      acc.revenue += ride.price
    } else {
      acc.ridesWithoutPrice += 1
    }

    acc.details.push({
      rideId: ride.rideId,
      date: ride.date,
      destinationName: ride.destinationName,
      distanceKm:
        ride.distanceMeters != null ? metersToKm(ride.distanceMeters) : null,
      price: ride.price != null ? round2(ride.price) : null,
    })
  }

  const accs = Array.from(byDriver.values()).sort((a, b) =>
    a.driverName.localeCompare(b.driverName, "de-CH")
  )

  const rows: DriverReportRow[] = []
  const details: Record<string, DriverRideDetail[]> = {}

  const summary: DriverReportSummary = {
    driverCount: accs.length,
    totalRides: 0,
    totalKm: 0,
    totalDurationSeconds: 0,
    totalRevenue: 0,
    totalCompensation: 0,
    ridesWithoutKm: 0,
    ridesWithoutPrice: 0,
  }

  for (const acc of accs) {
    const totalKm = metersToKm(acc.totalMeters)
    const revenue = round2(acc.revenue)
    const compensation = calculateCompensation(acc.rideCount, totalKm, rates)

    rows.push({
      driverId: acc.driverId,
      driverName: acc.driverName,
      rideCount: acc.rideCount,
      totalMeters: acc.totalMeters,
      totalKm,
      totalDurationSeconds: acc.totalDurationSeconds,
      revenue,
      compensation,
      ridesWithoutKm: acc.ridesWithoutKm,
      ridesWithoutPrice: acc.ridesWithoutPrice,
    })

    // Details are already in insertion (date) order per driver.
    details[acc.driverId] = acc.details

    summary.totalRides += acc.rideCount
    summary.totalDurationSeconds += acc.totalDurationSeconds
    summary.totalRevenue += revenue
    summary.totalCompensation += compensation
    summary.ridesWithoutKm += acc.ridesWithoutKm
    summary.ridesWithoutPrice += acc.ridesWithoutPrice
  }

  // Sum the already-rounded km/revenue/compensation so the total equals the
  // visible column sum (no rounding surprise between rows and the total row).
  summary.totalKm = round2(rows.reduce((s, r) => s + r.totalKm, 0))
  summary.totalRevenue = round2(summary.totalRevenue)
  summary.totalCompensation = round2(summary.totalCompensation)

  return { rows, details, summary }
}

// =============================================================================
// CSV formatting (aggregate-only — SEC-M14-009)
// =============================================================================

/**
 * CSV column allowlist. Aggregate figures only — deliberately NO destination or
 * patient columns to prevent health inference from an exported file (SEC-M14-009).
 */
const CSV_COLUMNS = [
  "driver_name",
  "ride_count",
  "km",
  "duration_min",
  "revenue_chf",
  "compensation_chf",
] as const

const CSV_HEADER_LABELS: Record<(typeof CSV_COLUMNS)[number], string> = {
  driver_name: "Fahrer",
  ride_count: "Fahrten",
  km: "km",
  duration_min: "Einsatzzeit (Min.)",
  revenue_chf: "Einnahmen (CHF)",
  compensation_chf: "Entschaedigung (CHF)",
}

/**
 * Escape a CSV field for semicolon-separated format (CH/DE Excel convention).
 * Matches the existing `/finance/export` CSV escaping exactly.
 */
function escapeCsvField(value: string): string {
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

/** Total ride duration in whole minutes. */
function durationToMinutes(totalSeconds: number): number {
  return Math.round(totalSeconds / 60)
}

/**
 * Format the aggregate driver report as a semicolon-separated CSV string with a
 * UTF-8 BOM and a trailing summary row — same shape/convention as the billing
 * export (dot decimals via toFixed, `;` separator, BOM for Excel).
 *
 * IMPORTANT: only aggregate rows are emitted. No drill-down / destination data.
 */
export function formatDriverReportCsv(
  rows: readonly DriverReportRow[],
  summary: DriverReportSummary
): string {
  const BOM = "﻿"

  const header = CSV_COLUMNS.map((key) =>
    escapeCsvField(CSV_HEADER_LABELS[key])
  ).join(";")

  const dataLines = rows.map((row) => {
    const cells: Record<(typeof CSV_COLUMNS)[number], string> = {
      driver_name: row.driverName,
      ride_count: row.rideCount.toString(),
      km: row.totalKm.toFixed(1),
      duration_min: durationToMinutes(row.totalDurationSeconds).toString(),
      revenue_chf: row.revenue.toFixed(2),
      compensation_chf: row.compensation.toFixed(2),
    }
    return CSV_COLUMNS.map((key) => escapeCsvField(cells[key])).join(";")
  })

  const summaryCells: Record<(typeof CSV_COLUMNS)[number], string> = {
    driver_name: `Total: ${summary.driverCount} Fahrer`,
    ride_count: summary.totalRides.toString(),
    km: summary.totalKm.toFixed(1),
    duration_min: durationToMinutes(summary.totalDurationSeconds).toString(),
    revenue_chf: summary.totalRevenue.toFixed(2),
    compensation_chf: summary.totalCompensation.toFixed(2),
  }
  const summaryLine = CSV_COLUMNS.map((key) =>
    escapeCsvField(summaryCells[key])
  ).join(";")

  return BOM + header + "\n" + dataLines.join("\n") + "\n" + summaryLine + "\n"
}
