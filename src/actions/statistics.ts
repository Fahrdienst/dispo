"use server"

import { requireAuth } from "@/lib/auth/require-auth"
import { rateLimit } from "@/lib/security/rate-limit"
import { logAudit } from "@/lib/audit/logger"
import { getStatistics } from "@/lib/finance/statistics-data"
import {
  formatStatisticsCsv,
  isStatDimension,
  STAT_DIMENSION_LABELS,
} from "@/lib/finance/statistics"
import type { ActionResult } from "@/actions/shared"

/** Validate a date string is in YYYY-MM-DD format and parseable. */
function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))
}

export interface StatisticsCsvResult {
  csv: string
  filename: string
}

/**
 * Export a statistics breakdown as a CSV string (Issue #155).
 *
 * The CSV is aggregate-only (dimension label + metrics; patient rows are
 * pseudonymized — SEC-M14-009) and the export is audited (`action='export'`,
 * `entity='report'` — SEC-M14-006), since exporting financial / health-adjacent
 * data must be attributable (Art. 5 Abs. 2 DSGVO). Returned as a string so the
 * (owned) client component can trigger the download without a separate API route.
 */
export async function exportStatisticsCsv(
  dimension: string,
  dateFrom: string,
  dateTo: string
): Promise<ActionResult<StatisticsCsvResult>> {
  // Defense-in-depth: the /finance layout already gates admin+operator.
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  // Rate limit per user (mirrors billing / driver-report export: 10/min).
  const limit = rateLimit(`statistics-export:${auth.userId}`, {
    maxRequests: 10,
    windowMs: 60 * 1000,
  })
  if (!limit.success) {
    return {
      success: false,
      error: "Zu viele Anfragen. Bitte versuchen Sie es in Kürze erneut.",
    }
  }

  if (!isStatDimension(dimension)) {
    return { success: false, error: "Ungültige Dimension." }
  }
  if (!isValidDate(dateFrom) || !isValidDate(dateTo)) {
    return { success: false, error: "Ungültiges Datumsformat." }
  }
  if (dateFrom > dateTo) {
    return { success: false, error: "Das Startdatum muss vor dem Enddatum liegen." }
  }

  const result = await getStatistics({ dateFrom, dateTo, dimension })
  const csv = formatStatisticsCsv(result)

  // SEC-M14-006: exports of financial/health-adjacent data must be attributable.
  logAudit({
    userId: auth.userId,
    userRole: auth.role,
    action: "export",
    entityType: "report",
    metadata: {
      report_type: "statistics",
      dimension,
      dimension_label: STAT_DIMENSION_LABELS[dimension],
      period_from: dateFrom,
      period_to: dateTo,
      row_count: result.summary.rowCount,
      ride_count: result.summary.totalRides,
    },
  }).catch(() => {})

  const filename = `statistik_${dimension}_${dateFrom}_${dateTo}.csv`
  return { success: true, data: { csv, filename } }
}
