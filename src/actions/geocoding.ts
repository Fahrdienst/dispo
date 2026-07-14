"use server"

import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/require-auth"
import { processGeocodingBatch } from "@/lib/maps/geocode-batch"
import type { BatchGeocodeResult } from "@/lib/maps/geocode-batch"
import type { ActionResult } from "@/actions/shared"

export async function getMapsHealthStats(): Promise<ActionResult<{
  patients: { total: number; geocoded: number; failed: number; pending: number }
  destinations: { total: number; geocoded: number; failed: number; pending: number }
}>> {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: "Nicht berechtigt" }
  }

  const supabase = await createClient()

  const [
    { count: pTotal },
    { count: pSuccess },
    { count: pFailed },
    { count: dTotal },
    { count: dSuccess },
    { count: dFailed },
  ] = await Promise.all([
    supabase.from("patients").select("id", { count: "exact", head: true }),
    supabase.from("patients").select("id", { count: "exact", head: true }).eq("geocode_status", "success"),
    supabase.from("patients").select("id", { count: "exact", head: true }).eq("geocode_status", "failed"),
    supabase.from("destinations").select("id", { count: "exact", head: true }),
    supabase.from("destinations").select("id", { count: "exact", head: true }).eq("geocode_status", "success"),
    supabase.from("destinations").select("id", { count: "exact", head: true }).eq("geocode_status", "failed"),
  ])

  return {
    success: true,
    data: {
      patients: {
        total: pTotal ?? 0,
        geocoded: pSuccess ?? 0,
        failed: pFailed ?? 0,
        pending: (pTotal ?? 0) - (pSuccess ?? 0) - (pFailed ?? 0),
      },
      destinations: {
        total: dTotal ?? 0,
        geocoded: dSuccess ?? 0,
        failed: dFailed ?? 0,
        pending: (dTotal ?? 0) - (dSuccess ?? 0) - (dFailed ?? 0),
      },
    },
  }
}

/** Upper bound on records processed per request, keeping each call well under
 *  the serverless time budget. The backfill UI calls this repeatedly. */
const MAX_BATCH_LIMIT = 100

/**
 * Processes one chunk of the geocoding backfill (patients + destinations with
 * pending/failed/null status and a complete address). Designed to be called
 * repeatedly by the client, passing back the returned `cursor` each time, until
 * `remaining` reaches 0.
 *
 * Preferred over a single full-table pass, which times out on ~1200 records.
 */
export async function geocodeBatch(
  limit = 50,
  cursor?: string
): Promise<ActionResult<BatchGeocodeResult>> {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: "Nicht berechtigt" }
  }

  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), MAX_BATCH_LIMIT)
  const supabase = await createClient()

  try {
    const data = await processGeocodingBatch(supabase, safeLimit, cursor)
    return { success: true, data }
  } catch (err) {
    console.error("geocodeBatch failed:", err)
    return {
      success: false,
      error: err instanceof Error ? err.message : "Geocoding fehlgeschlagen",
    }
  }
}
