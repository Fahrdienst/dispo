import { createClient } from "@/lib/supabase/server"
import { buildRideDescription } from "@/lib/receipts/format"
import type { BillableRide } from "@/lib/receipts/types"
import type { Enums } from "@/lib/types/database"

/**
 * Load all completed rides of a patient within [from, to] that are NOT already
 * part of an active (non-cancelled) receipt. Priceless rides are included but
 * carry `amount: null` so the UI can mark them "ohne Preis" and disable them.
 *
 * The caller (server component / server action) is responsible for the auth
 * gate; this function only reads through the RLS-scoped server client, so it is
 * additionally protected by the receipts/rides RLS policies.
 */
export async function getBillableRides(
  patientId: string,
  from: string,
  to: string
): Promise<BillableRide[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("rides")
    .select(
      "id, date, direction, distance_meters, calculated_price, price_override, patients(city), destinations(display_name)"
    )
    .eq("patient_id", patientId)
    .eq("status", "completed")
    .eq("is_active", true)
    .gte("date", from)
    .lte("date", to)
    .order("date")
    .order("pickup_time")

  if (error || !data) {
    if (error) console.error("getBillableRides failed:", error.message)
    return []
  }

  // Determine which of these rides are already on an active receipt.
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

  return data
    .filter((ride) => !receiptedIds.has(ride.id))
    .map((ride) => {
      const patient = ride.patients as { city: string | null } | null
      const destination = ride.destinations as { display_name: string } | null
      const direction = ride.direction as Enums<"ride_direction">
      const amount = ride.price_override ?? ride.calculated_price ?? null
      const distanceKm =
        ride.distance_meters != null
          ? Math.round(ride.distance_meters / 100) / 10
          : null

      return {
        id: ride.id,
        date: ride.date,
        direction,
        distanceKm,
        amount,
        description: buildRideDescription(
          patient?.city ?? null,
          destination?.display_name ?? "?",
          direction
        ),
      }
    })
}
