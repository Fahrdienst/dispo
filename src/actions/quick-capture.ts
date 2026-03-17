"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/require-auth"
import { logAudit } from "@/lib/audit/logger"
import { trackEvent } from "@/lib/telemetry"
import type { ActionResult } from "@/actions/shared"
import type { Enums } from "@/lib/types/database"

const quickCaptureSchema = z.object({
  patient_id: z.string().uuid("Patient ist erforderlich"),
  destination_id: z.string().uuid("Ziel ist erforderlich"),
  date: z.string().min(1, "Datum ist erforderlich"),
  pickup_time: z.string().min(1, "Abholzeit ist erforderlich"),
  direction: z.enum(["outbound", "return", "both"]),
})

export type QuickCaptureInput = z.infer<typeof quickCaptureSchema>

/**
 * Quick-capture ride creation: minimal fields, no redirect.
 * Returns the new ride date so the caller can refresh the correct view.
 *
 * For "both" direction: creates an outbound ride + a return ride with
 * the same pickup time (dispatcher will adjust later).
 */
export async function quickCreateRide(
  input: QuickCaptureInput
): Promise<ActionResult<{ date: string }>> {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const parsed = quickCaptureSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Ungueltige Eingabe"
    return { success: false, error: firstError }
  }

  const { patient_id, destination_id, date, pickup_time, direction } =
    parsed.data
  const supabase = await createClient()

  // Price calculation is best-effort for quick capture
  let priceFields: {
    distance_meters?: number
    duration_seconds?: number
    calculated_price?: number
    fare_rule_id?: string
  } = {}

  try {
    const [patientRes, destRes] = await Promise.all([
      supabase
        .from("patients")
        .select("postal_code, lat, lng, geocode_status")
        .eq("id", patient_id)
        .single(),
      supabase
        .from("destinations")
        .select("postal_code, lat, lng, geocode_status")
        .eq("id", destination_id)
        .single(),
    ])

    const patient = patientRes.data
    const dest = destRes.data

    if (
      patient?.postal_code &&
      dest?.postal_code &&
      patient.lat != null &&
      patient.lng != null &&
      dest.lat != null &&
      dest.lng != null
    ) {
      const { calculateRidePrice } = await import(
        "@/lib/billing/calculate-price"
      )
      const priceResult = await calculateRidePrice(
        patient.postal_code,
        dest.postal_code,
        { lat: patient.lat, lng: patient.lng },
        { lat: dest.lat, lng: dest.lng },
        date
      )

      if (priceResult) {
        priceFields = {
          distance_meters: priceResult.distance_meters,
          duration_seconds: priceResult.duration_seconds,
          calculated_price: priceResult.calculated_price,
          fare_rule_id: priceResult.fare_rule_id,
        }
      }
    }
  } catch (err: unknown) {
    console.error("Price calculation failed during quickCreateRide:", err)
  }

  if (direction === "both") {
    // Create outbound ride
    const { data: outboundRide, error: outError } = await supabase
      .from("rides")
      .insert({
        patient_id,
        destination_id,
        date,
        pickup_time,
        direction: "outbound" as Enums<"ride_direction">,
        status: "unplanned" as Enums<"ride_status">,
        ...priceFields,
      })
      .select("id")
      .single()

    if (outError) {
      return { success: false, error: outError.message }
    }

    // Create return ride linked to outbound
    const { error: retError } = await supabase.from("rides").insert({
      patient_id,
      destination_id,
      date,
      pickup_time,
      direction: "return" as Enums<"ride_direction">,
      status: "unplanned" as Enums<"ride_status">,
      parent_ride_id: outboundRide.id,
    })

    if (retError) {
      console.error("Failed to create return ride in quick capture:", retError.message)
    }

    trackEvent({
      event: "ride_quick_created",
      userId: auth.userId,
      properties: { direction: "both", count: 2 },
    })

    logAudit({
      userId: auth.userId,
      userRole: auth.role,
      action: "create",
      entityType: "ride",
      entityId: outboundRide.id,
      metadata: { source: "quick_capture", direction: "both" },
    }).catch(() => {})
  } else {
    // Single ride (outbound or return)
    const { data: ride, error } = await supabase
      .from("rides")
      .insert({
        patient_id,
        destination_id,
        date,
        pickup_time,
        direction: direction as Enums<"ride_direction">,
        status: "unplanned" as Enums<"ride_status">,
        ...priceFields,
      })
      .select("id")
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    trackEvent({
      event: "ride_quick_created",
      userId: auth.userId,
      properties: { direction, count: 1 },
    })

    logAudit({
      userId: auth.userId,
      userRole: auth.role,
      action: "create",
      entityType: "ride",
      entityId: ride.id,
      metadata: { source: "quick_capture", direction },
    }).catch(() => {})
  }

  revalidatePath("/rides")
  revalidatePath("/dispatch")
  revalidatePath("/")

  return { success: true, data: { date } }
}
