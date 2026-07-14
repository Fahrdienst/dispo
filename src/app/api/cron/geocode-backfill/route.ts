import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { processGeocodingBatch } from "@/lib/maps/geocode-batch"

/**
 * Vercel Cron endpoint: geocoding safety-net.
 *
 * Processes any records still needing geocoding (pending/failed/null with a
 * usable address) that on-create/on-update geocoding missed — e.g. transient
 * Google errors or records marked pending by a change-detection update.
 *
 * Idempotent and self-terminating: uses processGeocodingBatch's session cursor
 * so each record is attempted at most once per run; a no-op when nothing is
 * pending. Bounded per invocation by record count and wall-clock to stay under
 * the serverless time budget.
 *
 * Auth: CRON_SECRET in the Authorization header (Vercel sets this).
 */

export const maxDuration = 60

const BATCH_SIZE = 50
const MAX_RECORDS_PER_RUN = 300
const TIME_BUDGET_MS = 45_000

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createAdminClient()
  const startedAt = Date.now()

  let cursor: string | undefined
  let processed = 0
  let succeeded = 0
  let failed = 0
  let remaining = 0

  try {
    for (;;) {
      const res = await processGeocodingBatch(supabase, BATCH_SIZE, cursor)
      cursor = res.cursor
      processed += res.processed
      succeeded += res.succeeded
      failed += res.failed
      remaining = res.remaining

      if (res.remaining === 0 || res.processed === 0) break
      if (processed >= MAX_RECORDS_PER_RUN) break
      if (Date.now() - startedAt >= TIME_BUDGET_MS) break
    }

    return NextResponse.json({ success: true, processed, succeeded, failed, remaining })
  } catch (err) {
    console.error("Geocode backfill cron failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
