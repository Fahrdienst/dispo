import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/types/database"
import { geocodeAddress } from "./geocode"
import type { AddressInput } from "./types"

type GeocodableTable = "patients" | "destinations"

/** Records processed concurrently per chunk (Google Geocoding QPS is generous;
 *  the real constraint is the serverless time budget per HTTP call). */
const CONCURRENCY = 5

/** Status values that still need a geocoding attempt (success/manual excluded). */
const OPEN_STATUS_FILTER =
  "geocode_status.eq.failed,geocode_status.eq.pending,geocode_status.is.null"

export interface GeocodeBatchError {
  id: string
  table: GeocodableTable
  address: string
  error: string
}

export interface BatchGeocodeResult {
  processed: number
  succeeded: number
  failed: number
  /** Open, geocodable records left AFTER this batch (excludes ones attempted
   *  this session via the cursor). Reaches 0 when the backfill is complete. */
  remaining: number
  /** Server-authoritative session cursor. Pass it back on the next call so
   *  records attempted this session are not re-selected (guarantees the
   *  driving loop terminates and each record is attempted at most once). */
  cursor: string
  errors: GeocodeBatchError[]
}

interface OpenRecord {
  id: string
  street: string | null
  house_number: string | null
  postal_code: string | null
  city: string | null
}

type Client = SupabaseClient<Database>

function addressOf(r: OpenRecord): AddressInput {
  return {
    street: r.street!,
    house_number: r.house_number!,
    postal_code: r.postal_code!,
    city: r.city!,
  }
}

function addressLabel(a: AddressInput): string {
  return `${a.street} ${a.house_number}, ${a.postal_code} ${a.city}`
}

/** Fetch up to `limit` open, fully-addressed records not yet attempted this
 *  session (geocode_updated_at is null or older than the cursor). */
async function fetchOpen(
  supabase: Client,
  table: GeocodableTable,
  limit: number,
  cursor: string
): Promise<OpenRecord[]> {
  const { data, error } = await supabase
    .from(table)
    .select("id, street, house_number, postal_code, city")
    .or(OPEN_STATUS_FILTER)
    .or(`geocode_updated_at.is.null,geocode_updated_at.lt.${cursor}`)
    .not("street", "is", null)
    .not("house_number", "is", null)
    .not("postal_code", "is", null)
    .not("city", "is", null)
    .order("geocode_updated_at", { ascending: true, nullsFirst: true })
    .limit(limit)

  if (error) {
    throw new Error(`Konnte ${table} nicht laden: ${error.message}`)
  }
  return (data ?? []) as OpenRecord[]
}

/** Count open, fully-addressed records not yet attempted this session. */
async function countOpen(
  supabase: Client,
  table: GeocodableTable,
  cursor: string
): Promise<number> {
  const { count } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .or(OPEN_STATUS_FILTER)
    .or(`geocode_updated_at.is.null,geocode_updated_at.lt.${cursor}`)
    .not("street", "is", null)
    .not("house_number", "is", null)
    .not("postal_code", "is", null)
    .not("city", "is", null)
  return count ?? 0
}

/**
 * Geocode one record and persist the outcome. Always stamps geocode_updated_at
 * (>= cursor) so the record drops out of this session's open set — whether it
 * succeeded or failed. Returns an error descriptor on failure, else null.
 */
async function processRecord(
  supabase: Client,
  table: GeocodableTable,
  record: OpenRecord
): Promise<GeocodeBatchError | null> {
  const address = addressOf(record)
  const label = addressLabel(address)
  const now = new Date().toISOString()

  try {
    const result = await geocodeAddress(address)

    if (result) {
      const { error } = await supabase
        .from(table)
        .update({
          lat: result.lat,
          lng: result.lng,
          place_id: result.place_id,
          formatted_address: result.formatted_address,
          geocode_status: "success",
          geocode_updated_at: now,
        })
        .eq("id", record.id)
      if (error) {
        return { id: record.id, table, address: label, error: `DB-Update: ${error.message}` }
      }
      return null
    }

    // ZERO_RESULTS
    await supabase
      .from(table)
      .update({ geocode_status: "failed", geocode_updated_at: now })
      .eq("id", record.id)
    return { id: record.id, table, address: label, error: "Adresse nicht gefunden (ZERO_RESULTS)" }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // Best-effort: mark failed + stamp so it leaves this session's open set.
    try {
      await supabase
        .from(table)
        .update({ geocode_status: "failed", geocode_updated_at: now })
        .eq("id", record.id)
    } catch {
      // ignore secondary failure
    }
    return { id: record.id, table, address: label, error: message }
  }
}

/** Run tasks with bounded concurrency, collecting all results. */
async function mapWithConcurrency<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency)
    const settled = await Promise.allSettled(chunk.map(worker))
    for (const s of settled) {
      if (s.status === "fulfilled") {
        results.push(s.value)
      }
    }
  }
  return results
}

/**
 * Idempotent, chunked geocoding backfill over patients + destinations.
 *
 * Processes up to `limit` open records per call (patients first, then
 * destinations to fill the quota), at concurrency 5. Only records that still
 * need geocoding are touched (pending/failed/null status, complete address);
 * `success` and `manual` records are never re-geocoded, so manually corrected
 * coordinates are preserved.
 *
 * The session `cursor` (server-generated on the first call, echoed back by the
 * caller afterwards) ensures each record is attempted at most once per backfill
 * run and that the driving loop terminates even for permanently failing
 * addresses.
 */
export async function processGeocodingBatch(
  supabase: Client,
  limit = 50,
  cursor?: string
): Promise<BatchGeocodeResult> {
  const sessionCursor = cursor ?? new Date().toISOString()

  const patients = await fetchOpen(supabase, "patients", limit, sessionCursor)
  const destinations =
    patients.length < limit
      ? await fetchOpen(supabase, "destinations", limit - patients.length, sessionCursor)
      : []

  const tasks: Array<{ table: GeocodableTable; record: OpenRecord }> = [
    ...patients.map((record) => ({ table: "patients" as const, record })),
    ...destinations.map((record) => ({ table: "destinations" as const, record })),
  ]

  const errors = (
    await mapWithConcurrency(
      tasks,
      ({ table, record }) => processRecord(supabase, table, record),
      CONCURRENCY
    )
  ).filter((e): e is GeocodeBatchError => e !== null)

  const [remPatients, remDestinations] = await Promise.all([
    countOpen(supabase, "patients", sessionCursor),
    countOpen(supabase, "destinations", sessionCursor),
  ])

  return {
    processed: tasks.length,
    succeeded: tasks.length - errors.length,
    failed: errors.length,
    remaining: remPatients + remDestinations,
    cursor: sessionCursor,
    errors,
  }
}
