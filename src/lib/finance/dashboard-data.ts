/**
 * Finance dashboard — server-side data loading (Issue #154, M14 Phase 14.4).
 *
 * All aggregation happens in SQL (the `finance_dashboard_*` RPCs, migration
 * 20260723) so only tiny result sets cross the wire — never the raw ride rows.
 * RLS on `rides`/`receipt_items`/… plus the RPC role gate plus the `/finance`
 * layout gate (admin+operator) protect the underlying data (defense-in-depth).
 *
 * The pure math (deltas, month-series filling, top-list ordering) lives in
 * `dashboard.ts`; this module is the thin DB seam that feeds it.
 */

import { createClient } from "@/lib/supabase/server"
import { getToday } from "@/lib/utils/dates"
import {
  buildChartSeries,
  buildKpis,
  buildMonthTimeline,
  firstOfMonth,
  indexMonthlyStats,
  sortTopList,
  type ChartPoint,
  type DashboardKpis,
  type MonthlyStat,
  type TopListItem,
} from "@/lib/finance/dashboard"

/** Number of trailing months shown on the trend charts. */
const CHART_MONTHS = 12
/**
 * Aggregate window: the 12 chart months PLUS the 12 preceding months so each
 * chart point can look up its prior-year comparison. Also covers the KPI's
 * previous-year month.
 */
const WINDOW_MONTHS = CHART_MONTHS + 12
const TOP_LIST_LIMIT = 5

/** A recently issued receipt shown in the dashboard widget. */
export interface RecentReceipt {
  id: string
  receiptNumber: string
  recipientName: string
  totalAmount: number
  currency: string
  issuedAt: string
  status: "issued" | "cancelled"
  year: number
}

/** Everything the dashboard page renders. */
export interface DashboardData {
  /** First day of the current month (anchor for KPIs), YYYY-MM-01. */
  currentMonth: string
  kpis: DashboardKpis
  chart: ChartPoint[]
  topDestinations: TopListItem[]
  topPatients: TopListItem[]
  topDrivers: TopListItem[]
  recentReceipts: RecentReceipt[]
  /** Quittierbare (completed, bepreist, nicht aktiv quittierte) Fahrten im laufenden Monat. */
  receivableThisMonth: number
  /** Current calendar year (top lists reference the running year). */
  currentYear: number
}

/** Last day of the month containing YYYY-MM-01, as YYYY-MM-DD. */
function lastOfMonth(monthStart: string): string {
  const [yStr, mStr] = monthStart.split("-")
  // Day 0 of the *next* month (Date.UTC with month = m, day = 0) = last day
  // of month m (m being 1-based here, which is the next month 0-based).
  const d = new Date(Date.UTC(Number(yStr ?? ""), Number(mStr ?? ""), 0))
  return d.toISOString().slice(0, 10)
}

/** Map a top-list RPC result into the pure `TopListItem` shape (defensive). */
function toTopList(
  rows: { id: string; label: string; ride_count: number }[] | null
): TopListItem[] {
  const items: TopListItem[] = (rows ?? []).map((row) => ({
    id: row.id,
    label: row.label,
    count: row.ride_count,
  }))
  return sortTopList(items, TOP_LIST_LIMIT)
}

/**
 * Load and aggregate all dashboard data. Any RPC error degrades to empty data
 * for that section (the page still renders) and is logged for debuggability.
 */
export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient()

  const today = getToday()
  const currentMonth = firstOfMonth(today)
  const currentYear = Number(today.slice(0, 4))

  // 24-month aggregate window (oldest month .. today).
  const timeline = buildMonthTimeline(currentMonth, WINDOW_MONTHS)
  const windowFrom = timeline[0] ?? currentMonth
  const yearFrom = `${currentYear}-01-01`

  const [
    monthlyRes,
    topDestRes,
    topPatRes,
    topDrvRes,
    receivableRes,
    receiptsRes,
  ] = await Promise.all([
    supabase.rpc("finance_dashboard_monthly", {
      p_from: windowFrom,
      p_to: today,
    }),
    supabase.rpc("finance_dashboard_top_destinations", {
      p_from: yearFrom,
      p_to: today,
      p_limit: TOP_LIST_LIMIT,
    }),
    supabase.rpc("finance_dashboard_top_patients", {
      p_from: yearFrom,
      p_to: today,
      p_limit: TOP_LIST_LIMIT,
    }),
    supabase.rpc("finance_dashboard_top_drivers", {
      p_from: yearFrom,
      p_to: today,
      p_limit: TOP_LIST_LIMIT,
    }),
    supabase.rpc("finance_dashboard_receivable_count", {
      p_from: currentMonth,
      p_to: lastOfMonth(currentMonth),
    }),
    supabase
      .from("receipts")
      .select(
        "id, receipt_number, recipient_name, total_amount, currency, issued_at, status"
      )
      .order("issued_at", { ascending: false })
      .limit(5),
  ])

  if (monthlyRes.error) {
    console.error("finance_dashboard_monthly failed:", monthlyRes.error.message)
  }
  if (topDestRes.error) {
    console.error("top_destinations failed:", topDestRes.error.message)
  }
  if (topPatRes.error) {
    console.error("top_patients failed:", topPatRes.error.message)
  }
  if (topDrvRes.error) {
    console.error("top_drivers failed:", topDrvRes.error.message)
  }
  if (receivableRes.error) {
    console.error("receivable_count failed:", receivableRes.error.message)
  }
  if (receiptsRes.error) {
    console.error("recent receipts failed:", receiptsRes.error.message)
  }

  const monthlyStats: MonthlyStat[] = (monthlyRes.data ?? []).map((row) => ({
    // The RPC returns the month as a date string (YYYY-MM-DD); normalize to
    // the YYYY-MM-01 key the pure logic uses.
    month: firstOfMonth(row.month),
    rideCount: row.ride_count,
    revenue: row.revenue,
    totalMeters: row.total_meters,
  }))

  const statsByMonth = indexMonthlyStats(monthlyStats)
  const kpis = buildKpis(statsByMonth, currentMonth)
  const chart = buildChartSeries(
    statsByMonth,
    buildMonthTimeline(currentMonth, CHART_MONTHS)
  )

  const recentReceipts: RecentReceipt[] = (receiptsRes.data ?? []).map(
    (row) => ({
      id: row.id,
      receiptNumber: row.receipt_number,
      recipientName: row.recipient_name,
      totalAmount: row.total_amount,
      currency: row.currency,
      issuedAt: row.issued_at,
      status: row.status,
      year: Number(row.issued_at.slice(0, 4)),
    })
  )

  return {
    currentMonth,
    kpis,
    chart,
    topDestinations: toTopList(topDestRes.data),
    topPatients: toTopList(topPatRes.data),
    topDrivers: toTopList(topDrvRes.data),
    recentReceipts,
    receivableThisMonth: receivableRes.data ?? 0,
    currentYear,
  }
}
