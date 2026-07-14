import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/types/database"
import { getRoute } from "./directions"
import type { GeoPoint } from "./types"

/**
 * One-off, idempotent, chunked distance backfill (Issue #145, ADR-015 E8).
 *
 * Targets completed rides that never got a route distance (distance_meters IS
 * NULL) but whose patient AND destination are geocoded. For each it calls the
 * Google Directions API (via the existing lib/maps service, so the ADR-010
 * budget guard applies) and writes distance_meters/duration_seconds plus
 * distance_source = 'backfill'.
 *
 * Termination + idempotency mirror processGeocodingBatch, but the cursor is a
 * KEYSET over rides.id (not a timestamp): each call selects eligible rides with
 * id > cursor ascending, and returns the greatest id it touched. Successful
 * rides also drop out of the eligible set (distance_meters becomes non-null);
 * rides whose route call FAILS keep distance_meters NULL but fall behind the
 * cursor, so they are attempted at most once per run and the driving loop always
 * terminates. Manually corrected distances are never overwritten (the filter
 * only ever looks at distance_meters IS NULL).
 */

const ZERO_UUID = "00000000-0000-0000-0000-000000000000"

/** Records processed concurrently per chunk. Small, because each record is a
 *  billable Directions call under the shared budget (ADR-010). */
const CONCURRENCY = 3

export interface DistanceBackfillError {
  rideId: string
  error: string
}

export interface DistanceBackfillResult {
  processed: number
  succeeded: number
  failed: number
  /** Eligible (completed, no distance, geocoded) rides left AFTER this batch,
   *  i.e. with id > the returned cursor. Reaches 0 when the run is complete. */
  remaining: number
  /** Completed rides without distance whose patient/destination is NOT geocoded
   *  and therefore cannot be backfilled — the manual-nachpflege report count. */
  skipped: number
  /** Keyset cursor: the greatest rides.id attempted so far. Echo it back on the
   *  next call so each ride is attempted at most once per run. */
  cursor: string
  errors: DistanceBackfillError[]
}

interface EligibleRide {
  id: string
  patients: { lat: number | null; lng: number | null } | null
  destinations: { lat: number | null; lng: number | null } | null
}

type Client = SupabaseClient<Database>

/** Fetch up to `limit` eligible rides (completed, distance_meters NULL, patient
 *  + destination geocoded) with id > cursor, ordered by id ascending. */
async function fetchEligible(
  supabase: Client,
  limit: number,
  cursor: string
): Promise<EligibleRide[]> {
  const { data, error } = await supabase
    .from("rides")
    .select("id, patients!inner(lat, lng), destinations!inner(lat, lng)")
    .eq("status", "completed")
    .is("distance_meters", null)
    .not("patients.lat", "is", null)
    .not("patients.lng", "is", null)
    .not("destinations.lat", "is", null)
    .not("destinations.lng", "is", null)
    .gt("id", cursor)
    .order("id", { ascending: true })
    .limit(limit)

  if (error) {
    throw new Error(`Konnte Fahrten fuer den Distanz-Backfill nicht laden: ${error.message}`)
  }
  return (data ?? []) as unknown as EligibleRide[]
}

/** Count eligible (geocodable) rides with id > cursor still to do. */
async function countEligible(supabase: Client, cursor: string): Promise<number> {
  const { count } = await supabase
    .from("rides")
    .select("id, patients!inner(lat), destinations!inner(lat)", {
      count: "exact",
      head: true,
    })
    .eq("status", "completed")
    .is("distance_meters", null)
    .not("patients.lat", "is", null)
    .not("patients.lng", "is", null)
    .not("destinations.lat", "is", null)
    .not("destinations.lng", "is", null)
    .gt("id", cursor)
  return count ?? 0
}

/** Count completed rides without distance regardless of geocoding. */
async function countOpenTotal(supabase: Client): Promise<number> {
  const { count } = await supabase
    .from("rides")
    .select("id", { count: "exact", head: true })
    .eq("status", "completed")
    .is("distance_meters", null)
  return count ?? 0
}

function pointOf(p: { lat: number | null; lng: number | null }): GeoPoint | null {
  if (p.lat == null || p.lng == null) return null
  return { lat: p.lat, lng: p.lng }
}

/** Backfill one ride's distance. Returns an error descriptor on failure, else null. */
async function processRide(
  supabase: Client,
  ride: EligibleRide
): Promise<DistanceBackfillError | null> {
  const origin = ride.patients ? pointOf(ride.patients) : null
  const destination = ride.destinations ? pointOf(ride.destinations) : null

  // Defensive: the inner-join + not-null filters guarantee this, but never trust
  // the shape blindly.
  if (!origin || !destination) {
    return { rideId: ride.id, error: "Patient oder Ziel ohne Koordinaten" }
  }

  try {
    const route = await getRoute(origin, destination)
    const { error } = await supabase
      .from("rides")
      .update({
        distance_meters: route.distance_meters,
        duration_seconds: route.duration_seconds,
        distance_source: "backfill",
      })
      .eq("id", ride.id)
    if (error) {
      return { rideId: ride.id, error: `DB-Update: ${error.message}` }
    }
    return null
  } catch (err) {
    return { rideId: ride.id, error: err instanceof Error ? err.message : String(err) }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Run tasks with bounded concurrency, pausing `pauseMs` between chunks
 *  (rate-limiting, on top of the client-side budget guard). */
async function mapWithConcurrency<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  concurrency: number,
  pauseMs: number
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency)
    const settled = await Promise.allSettled(chunk.map(worker))
    for (const s of settled) {
      if (s.status === "fulfilled") results.push(s.value)
    }
    if (pauseMs > 0 && i + concurrency < items.length) {
      await sleep(pauseMs)
    }
  }
  return results
}

export interface DistanceBackfillOptions {
  /** Pause between concurrency chunks in ms (rate-limiting). Default 0. */
  pauseMs?: number
}

/**
 * Process one chunk of the distance backfill. Call repeatedly, echoing the
 * returned `cursor`, until `remaining` reaches 0 (complete) or `processed`
 * reaches 0 (nothing left to attempt).
 */
export async function processDistanceBackfill(
  supabase: Client,
  limit = 25,
  cursor?: string,
  options: DistanceBackfillOptions = {}
): Promise<DistanceBackfillResult> {
  const startCursor = cursor ?? ZERO_UUID
  const rides = await fetchEligible(supabase, limit, startCursor)

  // Advance the keyset cursor to the greatest id we attempt this call. Rides
  // come back ordered by id ascending, so the last one is the max.
  const newCursor = rides.length > 0 ? rides[rides.length - 1]!.id : startCursor

  const errors = (
    await mapWithConcurrency(
      rides,
      (ride) => processRide(supabase, ride),
      CONCURRENCY,
      options.pauseMs ?? 0
    )
  ).filter((e): e is DistanceBackfillError => e !== null)

  const [remaining, openTotal, remainingGeocodable] = await Promise.all([
    countEligible(supabase, newCursor),
    countOpenTotal(supabase),
    // eligible geocodable across the WHOLE set (cursor = ZERO) → used to derive
    // the non-geocodable "skipped" count independent of the cursor position.
    countEligible(supabase, ZERO_UUID),
  ])

  return {
    processed: rides.length,
    succeeded: rides.length - errors.length,
    failed: errors.length,
    remaining,
    // Completed-without-distance rides that are NOT geocodable = total open minus
    // those still geocodable minus those already successfully backfilled this run.
    // openTotal already excludes freshly-filled rides (distance now set), so:
    //   skipped = openTotal - remainingGeocodable
    skipped: Math.max(0, openTotal - remainingGeocodable),
    cursor: newCursor,
    errors,
  }
}
