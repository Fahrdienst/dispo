import { createClient } from "@/lib/supabase/server"
import { sumAmounts } from "@/lib/receipts/format"

/**
 * One patient with billable rides in a period, aggregated for the batch-run
 * preview (concept 4.2). `rideIds` lists ONLY the priced, still-billable rides
 * that will actually be receipted; priceless rides are counted separately in
 * `pricelessCount` and never flow into a receipt.
 */
export interface BatchCandidate {
  patientId: string
  patientName: string
  /** True when a patient e-mail is on file (drives the optional send step). */
  hasEmail: boolean
  /** Number of priced, billable rides (== rideIds.length). */
  rideCount: number
  /** Sum of the priced rides' effective amounts. */
  total: number
  /** Rides in the period without a price — excluded, shown as a warning. */
  pricelessCount: number
  /** Ids of the priced rides to receipt (server re-derives these on run). */
  rideIds: string[]
}

/**
 * Normalized input row for {@link buildBatchCandidates}: one billable ride with
 * its resolved patient and effective amount (`price_override ?? calculated_price`).
 */
export interface BatchRideRow {
  rideId: string
  patientId: string
  patientName: string
  hasEmail: boolean
  /** Effective price, or null when the ride has no price yet. */
  amount: number | null
}

/**
 * Pure aggregation: group billable ride rows by patient and compute per-patient
 * counts, sums and the priced ride-id list. No I/O — trivially unit-testable and
 * the single place the batch grouping rules live.
 *
 * Patients that end up with zero priced rides (only priceless ones) are still
 * returned so the operator sees the warning, but their `rideIds` is empty and
 * they are not runnable. Sorted by patient name for a stable UI.
 */
export function buildBatchCandidates(
  rows: readonly BatchRideRow[]
): BatchCandidate[] {
  const byPatient = new Map<string, BatchCandidate>()

  for (const row of rows) {
    let candidate = byPatient.get(row.patientId)
    if (!candidate) {
      candidate = {
        patientId: row.patientId,
        patientName: row.patientName,
        hasEmail: row.hasEmail,
        rideCount: 0,
        total: 0,
        pricelessCount: 0,
        rideIds: [],
      }
      byPatient.set(row.patientId, candidate)
    }

    if (row.amount == null) {
      candidate.pricelessCount += 1
    } else {
      candidate.rideCount += 1
      candidate.rideIds.push(row.rideId)
    }
  }

  // Compute totals in a rounding-safe pass, then sort by name.
  const amountsByPatient = new Map<string, number[]>()
  for (const row of rows) {
    if (row.amount == null) continue
    const list = amountsByPatient.get(row.patientId) ?? []
    list.push(row.amount)
    amountsByPatient.set(row.patientId, list)
  }
  for (const candidate of byPatient.values()) {
    candidate.total = sumAmounts(amountsByPatient.get(candidate.patientId) ?? [])
  }

  return Array.from(byPatient.values()).sort((a, b) =>
    a.patientName.localeCompare(b.patientName, "de")
  )
}

/**
 * Load all patients with billable rides in [from, to] for the batch preview.
 *
 * Mirrors {@link import("./queries").getBillableRides} but across ALL patients:
 * completed + active rides in range, excluding rides already on an active
 * (non-cancelled) receipt. Reads through the RLS-scoped server client, so it is
 * additionally protected by the receipts/rides RLS (admin+operator). The caller
 * owns the auth gate.
 */
export async function getBatchCandidates(
  from: string,
  to: string
): Promise<BatchCandidate[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("rides")
    .select(
      "id, patient_id, calculated_price, price_override, patients!inner(id, first_name, last_name, email, billing_recipient_name)"
    )
    .eq("status", "completed")
    .eq("is_active", true)
    .gte("date", from)
    .lte("date", to)
    .order("date")

  if (error || !data) {
    if (error) console.error("getBatchCandidates failed:", error.message)
    return []
  }

  // Exclude rides that are already part of an active receipt.
  const rideIds = data.map((r) => r.id)
  const receiptedIds = new Set<string>()
  if (rideIds.length > 0) {
    const { data: items } = await supabase
      .from("receipt_items")
      .select("ride_id")
      .eq("is_cancelled", false)
      .in("ride_id", rideIds)
    for (const item of items ?? []) {
      if (item.ride_id) receiptedIds.add(item.ride_id)
    }
  }

  const rows: BatchRideRow[] = []
  for (const ride of data) {
    if (receiptedIds.has(ride.id)) continue
    if (!ride.patient_id) continue

    // `patients!inner` yields a to-one relation; Supabase may type it as array.
    const patientRel = ride.patients as
      | {
          first_name: string
          last_name: string
          email: string | null
          billing_recipient_name: string | null
        }
      | {
          first_name: string
          last_name: string
          email: string | null
          billing_recipient_name: string | null
        }[]
      | null
    const patient = Array.isArray(patientRel) ? patientRel[0] : patientRel
    if (!patient) continue

    const billingName = patient.billing_recipient_name?.trim()
    const patientName =
      billingName && billingName.length > 0
        ? billingName
        : `${patient.first_name} ${patient.last_name}`.trim()

    rows.push({
      rideId: ride.id,
      patientId: ride.patient_id,
      patientName,
      hasEmail: !!patient.email,
      amount: ride.price_override ?? ride.calculated_price ?? null,
    })
  }

  return buildBatchCandidates(rows)
}
