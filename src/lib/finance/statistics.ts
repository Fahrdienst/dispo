/**
 * Statistics module — pure aggregation and CSV formatting (Issue #155, M14 Phase 14.4).
 *
 * Flexible reporting along Dimension × Metric × Period (concept section 7, ADR-015 E7):
 *
 *   Dimensions: time (month / quarter / year), driver, destination, zone,
 *               patient, direction (Hin/Rück).
 *   Metrics (all four at once): rides (count), km (Σ distance_meters),
 *               drive time (Σ duration_seconds), revenue (Σ effective price).
 *
 * This module is intentionally free of any DB / network access so the bucketing
 * (month/quarter/year), the backfill-share accounting and the CSV row shaping can
 * be unit-tested in isolation. Data fetching lives in `statistics-data.ts`.
 *
 * SEC-M14-009: the CSV export is aggregate-only (dimension label + metrics, no
 * extra attributes). For the "patient" dimension the CSV emits a pseudonym (not
 * the clear name); clear names appear only on-screen for admin/operator. The
 * column set is an explicit allowlist.
 *
 * km provenance (concept 7): rides carry `distance_source` ∈
 * {planned, backfill, estimate}. km derived from a non-`planned` source are
 * flagged per row and in the total as "davon nachberechnet". Rides without any
 * distance are counted separately so a km figure is never silently understated.
 */

import { round2, metersToKm } from "./driver-report"
import { RIDE_DIRECTION_LABELS } from "@/lib/rides/constants"
import { TARIFF_ZONE_LABELS } from "@/lib/billing/duebendorf-tariff"
import type { TariffZone } from "@/lib/billing/duebendorf-tariff"
import type { Database } from "@/lib/types/database"

type RideDirection = Database["public"]["Enums"]["ride_direction"]

// =============================================================================
// Dimensions
// =============================================================================

export type StatDimension =
  | "month"
  | "quarter"
  | "year"
  | "driver"
  | "destination"
  | "zone"
  | "patient"
  | "direction"

/** Ordered list of all dimensions (drives the UI selector order). */
export const STAT_DIMENSIONS: readonly StatDimension[] = [
  "month",
  "quarter",
  "year",
  "driver",
  "destination",
  "zone",
  "patient",
  "direction",
] as const

/** German display labels for the dimensions. */
export const STAT_DIMENSION_LABELS: Record<StatDimension, string> = {
  month: "Monat",
  quarter: "Quartal",
  year: "Jahr",
  driver: "Fahrer",
  destination: "Ziel",
  zone: "Zone",
  patient: "Patient",
  direction: "Richtung",
}

/** Dimensions whose rows can leak a medical/health context in an export. */
export const SENSITIVE_DIMENSIONS: ReadonlySet<StatDimension> = new Set<StatDimension>([
  "destination",
  "patient",
])

/** Runtime guard: is the given string a valid dimension? */
export function isStatDimension(value: string): value is StatDimension {
  return (STAT_DIMENSIONS as readonly string[]).includes(value)
}

// =============================================================================
// Types
// =============================================================================

/**
 * A single completed ride, normalized from the DB join. This is the pure input
 * to the aggregation — the caller flattens the Supabase result into this shape.
 */
export interface NormalizedStatRide {
  /** Ride date, ISO `YYYY-MM-DD`. */
  date: string
  driverId: string | null
  driverName: string | null
  destinationId: string
  destinationName: string | null
  patientId: string
  patientName: string | null
  /** Stored tariff zone (may be null for pre-tariff rides). */
  tariffZone: string | null
  direction: RideDirection
  distanceMeters: number | null
  /** `'planned' | 'backfill' | 'estimate'`. */
  distanceSource: string
  durationSeconds: number | null
  /** Effective price: COALESCE(price_override, calculated_price). */
  price: number | null
}

/** One aggregated row (a single value of the chosen dimension). */
export interface StatRow {
  /** Stable bucket key (used as React key + client sort tiebreak). */
  key: string
  /** On-screen label (may be a clear name). */
  label: string
  /**
   * Label to use in the CSV export. Equals `label` except for pseudonymized
   * dimensions (patient) where it is a non-identifying pseudonym (SEC-M14-009).
   */
  exportLabel: string
  /** Count of completed rides in the bucket. */
  rideCount: number
  /** Σ distance_meters (raw). */
  totalMeters: number
  /** Σ km, rounded to 1 decimal — the figure shown and exported. */
  totalKm: number
  /** Σ meters from a non-`planned` distance_source (backfill + estimate). */
  backfillMeters: number
  /** Recomputed km share, rounded to 1 decimal ("davon nachberechnet"). */
  backfillKm: number
  /** Rides in this bucket that carry no distance at all. */
  ridesWithoutKm: number
  /** Σ duration_seconds (pure ride time patient→destination). */
  totalDurationSeconds: number
  /** Σ effective price. */
  revenue: number
}

/** Grand-total summary across all buckets. */
export interface StatSummary {
  /** Number of dimension buckets (= rows). */
  rowCount: number
  totalRides: number
  totalMeters: number
  totalKm: number
  backfillKm: number
  ridesWithoutKm: number
  totalDurationSeconds: number
  totalRevenue: number
}

/** Full aggregation result. */
export interface StatisticsResult {
  dimension: StatDimension
  rows: StatRow[]
  summary: StatSummary
}

// =============================================================================
// Bucketing (time dimensions)
// =============================================================================

const MONTH_NAMES_DE = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
] as const

/** `2026-03-15` → `{ key: "2026-03", label: "März 2026" }`. */
export function monthBucket(date: string): { key: string; label: string } {
  const year = date.slice(0, 4)
  const monthStr = date.slice(5, 7)
  const monthIdx = Number.parseInt(monthStr, 10) - 1
  const monthName = MONTH_NAMES_DE[monthIdx] ?? monthStr
  return { key: `${year}-${monthStr}`, label: `${monthName} ${year}` }
}

/** `2026-05-15` → `{ key: "2026-Q2", label: "Q2 2026" }`. */
export function quarterBucket(date: string): { key: string; label: string } {
  const year = date.slice(0, 4)
  const monthIdx = Number.parseInt(date.slice(5, 7), 10) - 1
  const quarter = Math.floor(monthIdx / 3) + 1
  return { key: `${year}-Q${quarter}`, label: `Q${quarter} ${year}` }
}

/** `2026-03-15` → `{ key: "2026", label: "2026" }`. */
export function yearBucket(date: string): { key: string; label: string } {
  const year = date.slice(0, 4)
  return { key: year, label: year }
}

// =============================================================================
// Dimension mapping
// =============================================================================

const NO_DRIVER_KEY = "__none"
const UNKNOWN_ZONE_KEY = "__unknown"

/** Short, non-identifying pseudonym for a patient (SEC-M14-009). */
function patientPseudonym(patientId: string): string {
  return `P-${patientId.slice(0, 8)}`
}

/**
 * Map a ride to its `{ key, label, exportLabel }` for the chosen dimension.
 * `key` is the aggregation identity, `label` the on-screen text, `exportLabel`
 * the CSV text (pseudonymized where required).
 */
export function dimensionBucket(
  ride: NormalizedStatRide,
  dimension: StatDimension
): { key: string; label: string; exportLabel: string } {
  switch (dimension) {
    case "month": {
      const b = monthBucket(ride.date)
      return { key: b.key, label: b.label, exportLabel: b.label }
    }
    case "quarter": {
      const b = quarterBucket(ride.date)
      return { key: b.key, label: b.label, exportLabel: b.label }
    }
    case "year": {
      const b = yearBucket(ride.date)
      return { key: b.key, label: b.label, exportLabel: b.label }
    }
    case "driver": {
      const key = ride.driverId ?? NO_DRIVER_KEY
      const label = ride.driverName ?? "Ohne Fahrer"
      return { key, label, exportLabel: label }
    }
    case "destination": {
      const label = ride.destinationName ?? "Unbekanntes Ziel"
      return { key: ride.destinationId, label, exportLabel: label }
    }
    case "zone": {
      const zone = ride.tariffZone
      if (zone == null || zone === "") {
        return { key: UNKNOWN_ZONE_KEY, label: "Unbekannt", exportLabel: "Unbekannt" }
      }
      const label = TARIFF_ZONE_LABELS[zone as TariffZone] ?? zone
      return { key: zone, label, exportLabel: label }
    }
    case "patient": {
      const label = ride.patientName ?? "Unbekannt"
      // Clear name on screen, pseudonym in the export (SEC-M14-009).
      return {
        key: ride.patientId,
        label,
        exportLabel: patientPseudonym(ride.patientId),
      }
    }
    case "direction": {
      const label = RIDE_DIRECTION_LABELS[ride.direction] ?? ride.direction
      return { key: ride.direction, label, exportLabel: label }
    }
  }
}

/** Is this a time-based dimension (chronological sort, no drill relevance)? */
function isTimeDimension(dimension: StatDimension): boolean {
  return dimension === "month" || dimension === "quarter" || dimension === "year"
}

// =============================================================================
// Aggregation
// =============================================================================

/** Sum of already-1-decimal km values, kept at 1 decimal. */
function round1(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10
}

/**
 * Aggregate normalized rides into per-bucket rows + a grand-total summary.
 *
 * Default ordering:
 *  - time dimensions (month/quarter/year): chronological ascending (by key).
 *  - all other dimensions: by ride count descending, ties broken by label
 *    (de-CH collation). The client table lets the user re-sort by any metric.
 */
export function aggregateStatistics(
  rides: readonly NormalizedStatRide[],
  dimension: StatDimension
): StatisticsResult {
  interface Acc {
    key: string
    label: string
    exportLabel: string
    rideCount: number
    totalMeters: number
    backfillMeters: number
    ridesWithoutKm: number
    totalDurationSeconds: number
    revenue: number
  }

  const byKey = new Map<string, Acc>()

  for (const ride of rides) {
    const bucket = dimensionBucket(ride, dimension)
    let acc = byKey.get(bucket.key)
    if (!acc) {
      acc = {
        key: bucket.key,
        label: bucket.label,
        exportLabel: bucket.exportLabel,
        rideCount: 0,
        totalMeters: 0,
        backfillMeters: 0,
        ridesWithoutKm: 0,
        totalDurationSeconds: 0,
        revenue: 0,
      }
      byKey.set(bucket.key, acc)
    }

    acc.rideCount += 1

    if (ride.distanceMeters != null) {
      acc.totalMeters += ride.distanceMeters
      if (ride.distanceSource !== "planned") {
        acc.backfillMeters += ride.distanceMeters
      }
    } else {
      acc.ridesWithoutKm += 1
    }

    if (ride.durationSeconds != null) {
      acc.totalDurationSeconds += ride.durationSeconds
    }

    if (ride.price != null) {
      acc.revenue += ride.price
    }
  }

  const accs = Array.from(byKey.values())

  if (isTimeDimension(dimension)) {
    accs.sort((a, b) => a.key.localeCompare(b.key))
  } else {
    accs.sort((a, b) => {
      if (b.rideCount !== a.rideCount) return b.rideCount - a.rideCount
      return a.label.localeCompare(b.label, "de-CH")
    })
  }

  const rows: StatRow[] = accs.map((acc) => ({
    key: acc.key,
    label: acc.label,
    exportLabel: acc.exportLabel,
    rideCount: acc.rideCount,
    totalMeters: acc.totalMeters,
    totalKm: metersToKm(acc.totalMeters),
    backfillMeters: acc.backfillMeters,
    backfillKm: metersToKm(acc.backfillMeters),
    ridesWithoutKm: acc.ridesWithoutKm,
    totalDurationSeconds: acc.totalDurationSeconds,
    revenue: round2(acc.revenue),
  }))

  const summary: StatSummary = {
    rowCount: rows.length,
    totalRides: 0,
    totalMeters: 0,
    totalKm: 0,
    backfillKm: 0,
    ridesWithoutKm: 0,
    totalDurationSeconds: 0,
    totalRevenue: 0,
  }

  for (const row of rows) {
    summary.totalRides += row.rideCount
    summary.totalMeters += row.totalMeters
    summary.ridesWithoutKm += row.ridesWithoutKm
    summary.totalDurationSeconds += row.totalDurationSeconds
  }

  // Sum the already-rounded per-row figures so the total equals the visible
  // column sum (no rounding surprise between rows and the total row).
  summary.totalKm = round1(rows.reduce((s, r) => s + r.totalKm, 0))
  summary.backfillKm = round1(rows.reduce((s, r) => s + r.backfillKm, 0))
  summary.totalRevenue = round2(rows.reduce((s, r) => s + r.revenue, 0))

  return { dimension, rows, summary }
}

// =============================================================================
// CSV formatting (aggregate-only — SEC-M14-009)
// =============================================================================

/**
 * CSV column allowlist. Dimension label + metrics only — no drill-down, no extra
 * attributes. The dimension header text is dynamic (label of the chosen
 * dimension); all other headers are fixed.
 */
const STAT_CSV_COLUMNS = [
  "dimension",
  "ride_count",
  "km",
  "backfill_km",
  "rides_without_km",
  "duration_min",
  "revenue_chf",
] as const

type StatCsvColumn = (typeof STAT_CSV_COLUMNS)[number]

const STAT_CSV_HEADER_LABELS: Record<Exclude<StatCsvColumn, "dimension">, string> = {
  ride_count: "Fahrten",
  km: "km",
  backfill_km: "davon nachberechnet (km)",
  rides_without_km: "Fahrten ohne km",
  duration_min: "Fahrzeit (Min.)",
  revenue_chf: "Umsatz (CHF)",
}

/**
 * Escape a CSV field for semicolon-separated format (CH/DE Excel convention).
 * Matches the existing `/finance/export` and driver-report CSV escaping exactly.
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
 * Format an aggregate statistics result as a semicolon-separated CSV string with
 * a UTF-8 BOM and a trailing total row — same convention as the billing and
 * driver-report exports (dot decimals via toFixed, `;` separator, BOM for Excel).
 *
 * IMPORTANT: only the displayed aggregate rows are emitted; for the "patient"
 * dimension the pseudonymized `exportLabel` is used (SEC-M14-009).
 */
export function formatStatisticsCsv(result: StatisticsResult): string {
  const BOM = "﻿"
  const { dimension, rows, summary } = result

  const headerCells: Record<StatCsvColumn, string> = {
    dimension: STAT_DIMENSION_LABELS[dimension],
    ride_count: STAT_CSV_HEADER_LABELS.ride_count,
    km: STAT_CSV_HEADER_LABELS.km,
    backfill_km: STAT_CSV_HEADER_LABELS.backfill_km,
    rides_without_km: STAT_CSV_HEADER_LABELS.rides_without_km,
    duration_min: STAT_CSV_HEADER_LABELS.duration_min,
    revenue_chf: STAT_CSV_HEADER_LABELS.revenue_chf,
  }
  const header = STAT_CSV_COLUMNS.map((key) =>
    escapeCsvField(headerCells[key])
  ).join(";")

  const dataLines = rows.map((row) => {
    const cells: Record<StatCsvColumn, string> = {
      dimension: row.exportLabel,
      ride_count: row.rideCount.toString(),
      km: row.totalKm.toFixed(1),
      backfill_km: row.backfillKm.toFixed(1),
      rides_without_km: row.ridesWithoutKm.toString(),
      duration_min: durationToMinutes(row.totalDurationSeconds).toString(),
      revenue_chf: row.revenue.toFixed(2),
    }
    return STAT_CSV_COLUMNS.map((key) => escapeCsvField(cells[key])).join(";")
  })

  const summaryCells: Record<StatCsvColumn, string> = {
    dimension: "Total",
    ride_count: summary.totalRides.toString(),
    km: summary.totalKm.toFixed(1),
    backfill_km: summary.backfillKm.toFixed(1),
    rides_without_km: summary.ridesWithoutKm.toString(),
    duration_min: durationToMinutes(summary.totalDurationSeconds).toString(),
    revenue_chf: summary.totalRevenue.toFixed(2),
  }
  const summaryLine = STAT_CSV_COLUMNS.map((key) =>
    escapeCsvField(summaryCells[key])
  ).join(";")

  return BOM + header + "\n" + dataLines.join("\n") + "\n" + summaryLine + "\n"
}
