import { RIDE_DIRECTION_LABELS } from "@/lib/rides/constants"
import type { Enums } from "@/lib/types/database"

/**
 * Pure, dependency-free formatting helpers shared by the receipt create preview,
 * the server-side RPC mirror, and the PDF renderer. Keeping them here (no DB, no
 * React) makes them trivially unit-testable.
 */

/**
 * Build a ride description snapshot: "<Ort> → <Ziel> (<Richtung>)".
 *
 * MUST stay in sync with the SQL expression in
 * `20260720_000001_issue_receipt_rpc.sql`, otherwise the client preview and the
 * stored snapshot diverge. Falls back to "Start" when the origin city is empty.
 */
export function buildRideDescription(
  originCity: string | null,
  destinationName: string,
  direction: Enums<"ride_direction">
): string {
  const origin = originCity?.trim() || "Start"
  return `${origin} → ${destinationName} (${RIDE_DIRECTION_LABELS[direction]})`
}

/** Format a numeric amount with exactly two decimals (no currency prefix). */
export function formatAmount(amount: number): string {
  return amount.toFixed(2)
}

/** Format a CHF amount with currency prefix, e.g. 65 -> "CHF 65.00". */
export function formatChf(amount: number, currency = "CHF"): string {
  return `${currency} ${amount.toFixed(2)}`
}

/** Format kilometers with one decimal, or an en dash for null. */
export function formatKm(km: number | null): string {
  return km != null ? `${km.toFixed(1)} km` : "–"
}

/**
 * Format a YYYY-MM-DD date as Swiss short format "05.07.2026".
 * Parsed as local date (T00:00:00) to avoid timezone shifts.
 */
export function formatDateShort(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`)
  const dd = String(date.getDate()).padStart(2, "0")
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const yyyy = date.getFullYear()
  return `${dd}.${mm}.${yyyy}`
}

/** Sum the effective amounts of the given rides, ignoring null (priceless) ones. */
export function sumAmounts(amounts: readonly (number | null)[]): number {
  const total = amounts.reduce<number>((sum, a) => sum + (a ?? 0), 0)
  return Math.round(total * 100) / 100
}
