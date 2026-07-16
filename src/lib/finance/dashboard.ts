/**
 * Finance dashboard — pure calculation logic (Issue #154, M14 Phase 14.4).
 *
 * This module is intentionally free of any DB / network access so the period
 * math (month-over-month and year-over-year deltas), the 12/24-month series
 * construction (including empty months filled with zeros) and the top-list
 * ordering can be unit-tested in isolation. Data fetching lives in
 * `dashboard-data.ts`, which feeds the raw aggregates produced by the SQL RPCs
 * into these pure functions.
 *
 * Money / distance conventions are shared with the driver report:
 *   - revenue per ride = COALESCE(price_override, calculated_price)
 *   - km = distance_meters / 1000, rounded to 1 decimal (metersToKm)
 * The helpers are imported from `driver-report.ts` (shared, read-only) so the
 * rounding is identical across the finance area.
 */

import { metersToKm, round2 } from "@/lib/finance/driver-report"

// =============================================================================
// Types
// =============================================================================

/**
 * One month's aggregate as returned by the monthly RPC (already grouped in
 * SQL). `month` is the first day of the month (YYYY-MM-01).
 */
export interface MonthlyStat {
  month: string
  rideCount: number
  /** Σ COALESCE(price_override, calculated_price) over completed rides. */
  revenue: number
  /** Σ distance_meters over completed rides (raw meters). */
  totalMeters: number
}

export type DeltaDirection = "up" | "down" | "flat"

/** A period-over-period change. */
export interface Delta {
  /**
   * Percentage change vs the comparison period. `null` when the comparison
   * period had no value (a from-zero jump is not a meaningful percentage) —
   * the UI renders this as "—".
   */
  pct: number | null
  direction: DeltaDirection
}

/** A single KPI: current value plus both comparison deltas. */
export interface Kpi {
  /** Current-month value (CHF revenue, ride count, km, or avg price). */
  value: number
  vsPreviousMonth: Delta
  vsPreviousYear: Delta
}

/** The four dashboard KPIs for the current month. */
export interface DashboardKpis {
  revenue: Kpi
  rides: Kpi
  km: Kpi
  avgPrice: Kpi
}

/** One point on the 12-month trend charts. */
export interface ChartPoint {
  /** Month start, YYYY-MM-01. */
  month: string
  /** Short German label, e.g. "Feb 26". */
  label: string
  revenue: number
  km: number
  rideCount: number
  /** Revenue of the same month one year earlier (comparison overlay). */
  priorYearRevenue: number
}

/** A single entry in a top-5 list (destinations / patients / drivers). */
export interface TopListItem {
  id: string
  label: string
  count: number
}

// =============================================================================
// Month arithmetic (UTC-based to avoid timezone drift)
// =============================================================================

/** First day of the month containing a YYYY-MM-DD date (→ YYYY-MM-01). */
export function firstOfMonth(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`
}

/** Shift a YYYY-MM-01 month string by `delta` months (may be negative). */
export function shiftMonth(monthStart: string, delta: number): string {
  const [yStr, mStr] = monthStart.split("-")
  const year = Number(yStr ?? "")
  const month = Number(mStr ?? "") // 1-based
  const base = new Date(Date.UTC(year, month - 1 + delta, 1))
  const yy = base.getUTCFullYear()
  const mm = String(base.getUTCMonth() + 1).padStart(2, "0")
  return `${yy}-${mm}-01`
}

/**
 * Build a timeline of `count` month-start strings ending at (and including)
 * `anchorMonth`, oldest first.
 */
export function buildMonthTimeline(
  anchorMonth: string,
  count: number
): string[] {
  const months: string[] = []
  for (let i = count - 1; i >= 0; i--) {
    months.push(shiftMonth(anchorMonth, -i))
  }
  return months
}

const MONTH_LABELS_DE = [
  "Jan",
  "Feb",
  "Mär",
  "Apr",
  "Mai",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dez",
] as const

/** Format a YYYY-MM-01 month as a compact German label, e.g. "Feb 26". */
export function formatMonthLabel(monthStart: string): string {
  const [yStr, mStr] = monthStart.split("-")
  const month = Number(mStr ?? "")
  const name = MONTH_LABELS_DE[month - 1] ?? ""
  return `${name} ${(yStr ?? "").slice(2)}`
}

// =============================================================================
// Aggregation helpers
// =============================================================================

/** Index monthly stats by their `month` key for O(1) lookup. */
export function indexMonthlyStats(
  stats: readonly MonthlyStat[]
): Map<string, MonthlyStat> {
  const map = new Map<string, MonthlyStat>()
  for (const stat of stats) {
    map.set(stat.month, stat)
  }
  return map
}

/** Look up a month, returning a zero-filled stat for empty months. */
function statFor(
  statsByMonth: Map<string, MonthlyStat>,
  month: string
): MonthlyStat {
  return (
    statsByMonth.get(month) ?? {
      month,
      rideCount: 0,
      revenue: 0,
      totalMeters: 0,
    }
  )
}

/** Average price per ride; 0 when there are no rides (avoids divide-by-zero). */
export function averagePrice(revenue: number, rideCount: number): number {
  if (rideCount <= 0) return 0
  return round2(revenue / rideCount)
}

/**
 * Compute a period-over-period delta. A comparison base of 0 yields a `null`
 * percentage (rendered "—") because a from-zero jump has no finite percentage.
 */
export function computeDelta(current: number, previous: number): Delta {
  if (previous <= 0) {
    return { pct: null, direction: current > 0 ? "up" : "flat" }
  }
  const pct = round2(((current - previous) / previous) * 100)
  const direction: DeltaDirection = pct > 0 ? "up" : pct < 0 ? "down" : "flat"
  return { pct, direction }
}

// =============================================================================
// KPI + chart series construction
// =============================================================================

/**
 * Build the four current-month KPIs with month-over-month and year-over-year
 * deltas. The current month may be partial (month-to-date); the comparison
 * months are whole — standard for such dashboards.
 */
export function buildKpis(
  statsByMonth: Map<string, MonthlyStat>,
  currentMonth: string
): DashboardKpis {
  const cur = statFor(statsByMonth, currentMonth)
  const prevM = statFor(statsByMonth, shiftMonth(currentMonth, -1))
  const prevY = statFor(statsByMonth, shiftMonth(currentMonth, -12))

  const curKm = metersToKm(cur.totalMeters)
  const prevMKm = metersToKm(prevM.totalMeters)
  const prevYKm = metersToKm(prevY.totalMeters)

  const curAvg = averagePrice(cur.revenue, cur.rideCount)
  const prevMAvg = averagePrice(prevM.revenue, prevM.rideCount)
  const prevYAvg = averagePrice(prevY.revenue, prevY.rideCount)

  return {
    revenue: {
      value: round2(cur.revenue),
      vsPreviousMonth: computeDelta(cur.revenue, prevM.revenue),
      vsPreviousYear: computeDelta(cur.revenue, prevY.revenue),
    },
    rides: {
      value: cur.rideCount,
      vsPreviousMonth: computeDelta(cur.rideCount, prevM.rideCount),
      vsPreviousYear: computeDelta(cur.rideCount, prevY.rideCount),
    },
    km: {
      value: curKm,
      vsPreviousMonth: computeDelta(curKm, prevMKm),
      vsPreviousYear: computeDelta(curKm, prevYKm),
    },
    avgPrice: {
      value: curAvg,
      vsPreviousMonth: computeDelta(curAvg, prevMAvg),
      vsPreviousYear: computeDelta(curAvg, prevYAvg),
    },
  }
}

/**
 * Build the 12-month chart series from the 24-month aggregate window. Each
 * point carries revenue/km/ride count plus the revenue of the same month one
 * year earlier (looked up from the wider window) for the comparison overlay.
 */
export function buildChartSeries(
  statsByMonth: Map<string, MonthlyStat>,
  timeline: readonly string[]
): ChartPoint[] {
  return timeline.map((month) => {
    const stat = statFor(statsByMonth, month)
    const priorYear = statFor(statsByMonth, shiftMonth(month, -12))
    return {
      month,
      label: formatMonthLabel(month),
      revenue: round2(stat.revenue),
      km: metersToKm(stat.totalMeters),
      rideCount: stat.rideCount,
      priorYearRevenue: round2(priorYear.revenue),
    }
  })
}

/**
 * Deterministically order a top list: by count descending, ties broken by
 * label (de-CH collation), then truncated to `limit`. The RPC already orders
 * and limits; this guarantees a stable render order and a consistent tie-break.
 */
export function sortTopList(
  items: readonly TopListItem[],
  limit: number
): TopListItem[] {
  return [...items]
    .sort(
      (a, b) => b.count - a.count || a.label.localeCompare(b.label, "de-CH")
    )
    .slice(0, limit)
}

// =============================================================================
// Display formatting (de-CH)
// =============================================================================

/** Format a CHF amount, e.g. 1234.5 → "1'234.50". */
export function formatChf(value: number): string {
  return value.toLocaleString("de-CH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Format an integer with de-CH grouping, e.g. 1234 → "1'234". */
export function formatInt(value: number): string {
  return value.toLocaleString("de-CH", { maximumFractionDigits: 0 })
}

/** Format a km value with one decimal, e.g. 1234.5 → "1'234.5". */
export function formatKm(value: number): string {
  return value.toLocaleString("de-CH", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

/** Format a delta percentage with sign, e.g. +12.3 %; "—" when not comparable. */
export function formatDeltaPct(delta: Delta): string {
  if (delta.pct === null) return "—"
  const sign = delta.pct > 0 ? "+" : ""
  const formatted = delta.pct.toLocaleString("de-CH", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  return `${sign}${formatted} %`
}
