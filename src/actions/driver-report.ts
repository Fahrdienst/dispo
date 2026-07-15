"use server"

import { requireAuth } from "@/lib/auth/require-auth"
import { rateLimit } from "@/lib/security/rate-limit"
import { logAudit } from "@/lib/audit/logger"
import { getDriverReport } from "@/lib/finance/driver-report-data"
import { formatDriverReportCsv } from "@/lib/finance/driver-report"
import type { ActionResult } from "@/actions/shared"

/** Validate a date string is in YYYY-MM-DD format and parseable. */
function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))
}

export interface DriverReportCsvResult {
  csv: string
  filename: string
}

/**
 * Export the aggregate driver report as a CSV string (Issue #153).
 *
 * The CSV is aggregate-only (no destinations/patients — SEC-M14-009) and the
 * export is audited (`action='export'`, `entity='report'` — SEC-M14-006), since
 * exporting financial / health-adjacent data must be attributable (Art. 5 Abs. 2
 * DSGVO). Returned as a string so the (owned) client component can trigger the
 * download without a separate API route.
 */
export async function exportDriverReportCsv(
  dateFrom: string,
  dateTo: string
): Promise<ActionResult<DriverReportCsvResult>> {
  // Defense-in-depth: the /finance layout already gates admin+operator.
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  // Rate limit per user (mirrors billing export: 10/min).
  const limit = rateLimit(`driver-report-export:${auth.userId}`, {
    maxRequests: 10,
    windowMs: 60 * 1000,
  })
  if (!limit.success) {
    return {
      success: false,
      error: "Zu viele Anfragen. Bitte versuchen Sie es in Kürze erneut.",
    }
  }

  if (!isValidDate(dateFrom) || !isValidDate(dateTo)) {
    return { success: false, error: "Ungültiges Datumsformat." }
  }
  if (dateFrom > dateTo) {
    return { success: false, error: "Das Startdatum muss vor dem Enddatum liegen." }
  }

  const report = await getDriverReport({ dateFrom, dateTo })
  const csv = formatDriverReportCsv(report.rows, report.summary)

  // SEC-M14-006: exports of financial/health-adjacent data must be attributable.
  logAudit({
    userId: auth.userId,
    userRole: auth.role,
    action: "export",
    entityType: "report",
    metadata: {
      report_type: "driver_report",
      period_from: dateFrom,
      period_to: dateTo,
      driver_count: report.summary.driverCount,
      ride_count: report.summary.totalRides,
    },
  }).catch(() => {})

  const filename = `fahrer-report_${dateFrom}_${dateTo}.csv`
  return { success: true, data: { csv, filename } }
}
