import { NextResponse, type NextRequest } from "next/server"
import { requireAuth } from "@/lib/auth/require-auth"
import { getBillingData, formatBillingCsv } from "@/lib/billing/export"
import type { Enums } from "@/lib/types/database"

const VALID_STATUSES: ReadonlySet<string> = new Set([
  "unplanned",
  "planned",
  "confirmed",
  "in_progress",
  "picked_up",
  "arrived",
  "completed",
  "cancelled",
  "no_show",
  "rejected",
])

/**
 * Validate a date string is in YYYY-MM-DD format.
 */
function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value))
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // 1. Auth check
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 403 })
  }

  // 2. Parse and validate search params
  const { searchParams } = request.nextUrl
  const dateFrom = searchParams.get("dateFrom")
  const dateTo = searchParams.get("dateTo")
  const statusParam = searchParams.getAll("status")

  if (!dateFrom || !dateTo) {
    return NextResponse.json(
      { error: "dateFrom and dateTo are required" },
      { status: 400 }
    )
  }

  if (!isValidDate(dateFrom) || !isValidDate(dateTo)) {
    return NextResponse.json(
      { error: "Invalid date format. Use YYYY-MM-DD." },
      { status: 400 }
    )
  }

  if (dateFrom > dateTo) {
    return NextResponse.json(
      { error: "dateFrom must be before or equal to dateTo" },
      { status: 400 }
    )
  }

  // Validate status values
  const validatedStatuses: Enums<"ride_status">[] = []
  for (const s of statusParam) {
    if (!VALID_STATUSES.has(s)) {
      return NextResponse.json(
        { error: `Invalid status: ${s}` },
        { status: 400 }
      )
    }
    validatedStatuses.push(s as Enums<"ride_status">)
  }

  // 3. Fetch billing data
  const { rows } = await getBillingData({
    dateFrom,
    dateTo,
    status: validatedStatuses.length > 0 ? validatedStatuses : undefined,
  })

  // 4. Format CSV
  const csv = formatBillingCsv(rows)

  // 5. Return CSV response with proper headers
  const filename = `verrechnung_${dateFrom}_${dateTo}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
