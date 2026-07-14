"use server"

import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/require-auth"
import { logAudit } from "@/lib/audit/logger"
import {
  processDistanceBackfill,
  type DistanceBackfillResult,
} from "@/lib/maps/distance-backfill"
import type { ActionResult } from "@/actions/shared"

/** Upper bound per request, keeping each call well under the serverless budget.
 *  Each record is a billable Directions call, so this stays modest. */
const MAX_BATCH_LIMIT = 50

/** Inter-chunk pause (ms) for rate-limiting the Directions calls (on top of the
 *  client-side ADR-010 budget guard). */
const PAUSE_MS = 150

/**
 * Process one chunk of the one-off distance backfill (Issue #145). Admin-only.
 * Designed to be called repeatedly by the client, echoing the returned `cursor`,
 * until `remaining` reaches 0.
 *
 * SEC-M14-013: each chunk that touches rides is audited (who ran it, when, how
 * many affected/skipped). The skipped report never carries patient names.
 */
export async function distanceBackfillBatch(
  limit = 25,
  cursor?: string
): Promise<ActionResult<DistanceBackfillResult>> {
  const auth = await requireAuth(["admin"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), MAX_BATCH_LIMIT)
  const supabase = await createClient()

  try {
    const data = await processDistanceBackfill(supabase, safeLimit, cursor, {
      pauseMs: PAUSE_MS,
    })

    // SEC-M14-013: audit the run (only when it actually did work).
    if (data.processed > 0) {
      logAudit({
        userId: auth.userId,
        userRole: auth.role,
        action: "update",
        entityType: "ride",
        metadata: {
          job: "distance_backfill",
          processed: data.processed,
          succeeded: data.succeeded,
          failed: data.failed,
          skipped: data.skipped,
        },
      }).catch(() => {})
    }

    return { success: true, data }
  } catch (err) {
    console.error("distanceBackfillBatch failed:", err)
    return {
      success: false,
      error: err instanceof Error ? err.message : "Distanz-Backfill fehlgeschlagen",
    }
  }
}

export interface SkippedRide {
  id: string
  date: string
}

/**
 * Completed rides without distance whose patient or destination is not geocoded
 * — the manual-nachpflege report. Returns ids + dates only (no patient names,
 * SEC-M14-013).
 */
export async function getDistanceBackfillSkipped(
  limit = 200
): Promise<ActionResult<SkippedRide[]>> {
  const auth = await requireAuth(["admin"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("rides")
    .select("id, date, patients(lat), destinations(lat)")
    .eq("status", "completed")
    .is("distance_meters", null)
    .order("date", { ascending: false })
    .limit(Math.min(Math.max(1, Math.floor(limit)), 1000))

  if (error) {
    return { success: false, error: error.message }
  }

  type Row = {
    id: string
    date: string
    patients: { lat: number | null } | null
    destinations: { lat: number | null } | null
  }

  const skipped = ((data ?? []) as unknown as Row[])
    .filter((r) => r.patients?.lat == null || r.destinations?.lat == null)
    .map((r) => ({ id: r.id, date: r.date }))

  return { success: true, data: skipped }
}
