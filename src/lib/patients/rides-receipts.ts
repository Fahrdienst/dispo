/**
 * Pure view-model + period helpers for the patient detail
 * "Fahrten & Quittungen" tab (Issue #150, M14 Phase 14.2).
 *
 * All functions here are side-effect free so they can be unit-tested without a
 * database. The Server Component loads the raw rows; these helpers shape them
 * into display rows, mark receipted rides, and drive the period filter.
 */

import type { Enums } from "@/lib/types/database"

type RideStatus = Enums<"ride_status">
type RideDirection = Enums<"ride_direction">
type ReceiptStatus = Enums<"receipt_status">

// =============================================================================
// Raw input shapes (subset of the DB rows the page selects)
// =============================================================================

/** Minimal ride shape loaded for the patient tab (with joined destination). */
export interface RawPatientRide {
  id: string
  date: string
  pickup_time: string
  direction: RideDirection
  status: RideStatus
  distance_meters: number | null
  calculated_price: number | null
  price_override: number | null
  destination: { display_name: string } | null
}

/** Minimal receipt item shape used to detect which rides are already receipted. */
export interface RawReceiptItem {
  ride_id: string | null
  is_cancelled: boolean
}

/** Minimal receipt shape loaded for the receipts list. */
export interface RawPatientReceipt {
  id: string
  receipt_number: string
  period_from: string
  period_to: string
  total_amount: number
  status: ReceiptStatus
  pdf_path: string | null
}

// =============================================================================
// Display shapes
// =============================================================================

export interface PatientRideRow {
  id: string
  date: string
  pickupTime: string
  destinationName: string
  direction: RideDirection
  status: RideStatus
  /** Distance in km (1 decimal), or null when no distance is recorded. */
  distanceKm: number | null
  /** Effective price = price_override ?? calculated_price. */
  price: number | null
  /** Whether the ride has an effective price at all. */
  hasPrice: boolean
  /** Whether the ride is part of an active (non-cancelled) receipt. */
  isReceipted: boolean
}

export interface PatientReceiptRow {
  id: string
  receiptNumber: string
  periodFrom: string
  periodTo: string
  totalAmount: number
  status: ReceiptStatus
  pdfPath: string | null
}

export interface Period {
  /** Inclusive lower bound, YYYY-MM-DD. */
  from: string
  /** Inclusive upper bound, YYYY-MM-DD. */
  to: string
}

// =============================================================================
// Receipt marking
// =============================================================================

/**
 * Effective price of a ride: a manual override wins over the calculated price.
 * Returns null when neither is set (ride "ohne Preis").
 */
export function getEffectivePrice(
  calculatedPrice: number | null,
  priceOverride: number | null
): number | null {
  return priceOverride ?? calculatedPrice
}

/**
 * Build the set of ride ids that are covered by an ACTIVE receipt.
 *
 * A ride counts as receipted only through a receipt_item with
 * `is_cancelled = false`. When a receipt is cancelled, the storno trigger flips
 * its items to `is_cancelled = true`, which makes the ride quittierbar again —
 * so those items must NOT mark the ride as receipted here.
 */
export function buildActiveReceiptRideIds(
  items: readonly RawReceiptItem[]
): Set<string> {
  const ids = new Set<string>()
  for (const item of items) {
    if (!item.is_cancelled && item.ride_id !== null) {
      ids.add(item.ride_id)
    }
  }
  return ids
}

/** Convert distance in meters to km with one decimal, or null. */
export function metersToKm(distanceMeters: number | null): number | null {
  if (distanceMeters === null) return null
  return Math.round((distanceMeters / 1000) * 10) / 10
}

/** Map raw rides + active-receipt ride ids to display rows. */
export function buildRideRows(
  rides: readonly RawPatientRide[],
  activeReceiptRideIds: ReadonlySet<string>
): PatientRideRow[] {
  return rides.map((ride) => {
    const price = getEffectivePrice(ride.calculated_price, ride.price_override)
    return {
      id: ride.id,
      date: ride.date,
      pickupTime: ride.pickup_time,
      destinationName: ride.destination?.display_name ?? "–",
      direction: ride.direction,
      status: ride.status,
      distanceKm: metersToKm(ride.distance_meters),
      price,
      hasPrice: price !== null,
      isReceipted: activeReceiptRideIds.has(ride.id),
    }
  })
}

/** Map raw receipts to display rows. */
export function buildReceiptRows(
  receipts: readonly RawPatientReceipt[]
): PatientReceiptRow[] {
  return receipts.map((r) => ({
    id: r.id,
    receiptNumber: r.receipt_number,
    periodFrom: r.period_from,
    periodTo: r.period_to,
    totalAmount: r.total_amount,
    status: r.status,
    pdfPath: r.pdf_path,
  }))
}

// =============================================================================
// Period filtering
// =============================================================================

/** Whether a from/to pair is a well-formed, non-inverted period. */
export function isValidPeriod(from: string, to: string): boolean {
  const isDate = (s: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(s)
  if (!isDate(from) || !isDate(to)) return false
  return from <= to
}

/**
 * Filter ride rows to those whose date falls within [from, to] inclusive.
 * Comparison is lexicographic on YYYY-MM-DD, which is order-preserving.
 */
export function filterRowsByPeriod(
  rows: readonly PatientRideRow[],
  period: Period
): PatientRideRow[] {
  return rows.filter((r) => r.date >= period.from && r.date <= period.to)
}

/**
 * Number of rides in the given rows that are completed but NOT yet on an active
 * receipt — i.e. the work stock that "Quittung erstellen" would cover. When this
 * is zero, the create button is hidden.
 */
export function countUnreceiptedCompleted(
  rows: readonly PatientRideRow[]
): number {
  return rows.filter((r) => r.status === "completed" && !r.isReceipted).length
}

// =============================================================================
// Month helpers (default period = current month)
// =============================================================================

const MONTH_LABELS_DE = [
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

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

/**
 * Inclusive first/last day of a calendar month as a Period.
 * `month0` is 0-based (0 = January), matching JS Date semantics.
 */
export function getMonthBounds(year: number, month0: number): Period {
  // Normalise overflow/underflow (e.g. month0 = 12 -> next January).
  const normYear = year + Math.floor(month0 / 12)
  const normMonth0 = ((month0 % 12) + 12) % 12
  const from = `${normYear}-${pad2(normMonth0 + 1)}-01`
  // Day 0 of the next month = last day of this month.
  const lastDay = new Date(Date.UTC(normYear, normMonth0 + 1, 0)).getUTCDate()
  const to = `${normYear}-${pad2(normMonth0 + 1)}-${pad2(lastDay)}`
  return { from, to }
}

/** Parse a YYYY-MM-DD string into { year, month0 } (no timezone drift). */
export function parseYearMonth(dateStr: string): { year: number; month0: number } {
  const year = Number(dateStr.slice(0, 4))
  const month0 = Number(dateStr.slice(5, 7)) - 1
  return { year, month0 }
}

/** German month label, e.g. (2026, 6) -> "Juli 2026". */
export function formatMonthLabel(year: number, month0: number): string {
  const normMonth0 = ((month0 % 12) + 12) % 12
  const normYear = year + Math.floor(month0 / 12)
  return `${MONTH_LABELS_DE[normMonth0]} ${normYear}`
}

/** Format a YYYY-MM-DD as DD.MM.YYYY for compact display. */
export function formatDateShort(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr
  return `${dateStr.slice(8, 10)}.${dateStr.slice(5, 7)}.${dateStr.slice(0, 4)}`
}

/** Format a numeric CHF amount, e.g. 12.5 -> "CHF 12.50". */
export function formatChf(amount: number): string {
  return `CHF ${amount.toFixed(2)}`
}
