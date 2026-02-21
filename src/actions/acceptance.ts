"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/require-auth"
import { invalidateTokensForRide } from "@/lib/mail/tokens"
import { resolveAcceptance } from "@/lib/acceptance/engine"
import { rejectionSchema } from "@/lib/validations/acceptance"
import type { ActionResult } from "@/actions/shared"
import type { RejectionReason } from "@/lib/acceptance/types"

/**
 * Confirm a ride assignment (driver action from /my/rides).
 * Transitions ride from planned → confirmed.
 */
export async function confirmAssignment(
  rideId: string
): Promise<ActionResult> {
  const auth = await requireAuth(["driver"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const supabase = await createClient()

  // Verify this ride is assigned to the current driver
  const { data: ride } = await supabase
    .from("rides")
    .select("id, status, driver_id")
    .eq("id", rideId)
    .single()

  if (!ride) {
    return { success: false, error: "Fahrt nicht gefunden" }
  }

  if (ride.driver_id !== auth.driverId) {
    return { success: false, error: "Keine Berechtigung fuer diese Fahrt" }
  }

  if (ride.status !== "planned") {
    return {
      success: false,
      error: "Fahrt kann in diesem Status nicht bestaetigt werden",
    }
  }

  // Update ride status
  const { error } = await supabase
    .from("rides")
    .update({ status: "confirmed" })
    .eq("id", rideId)

  if (error) {
    return { success: false, error: error.message }
  }

  // SEC-M9-006: Invalidate all tokens for this ride
  await invalidateTokensForRide(rideId)

  // Resolve acceptance tracking
  await resolveAcceptance(rideId, "confirmed", "driver_app")

  revalidatePath("/my/rides")
  revalidatePath("/dispatch")
  revalidatePath("/rides")
  return { success: true, data: undefined }
}

/**
 * Reject a ride assignment with a reason (driver action from /my/rides).
 * Transitions ride from planned → rejected.
 */
export async function rejectAssignment(
  rideId: string,
  reasonCode: string,
  reasonText?: string
): Promise<ActionResult> {
  const auth = await requireAuth(["driver"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  // Validate rejection input
  const result = rejectionSchema.safeParse({
    ride_id: rideId,
    rejection_reason: reasonCode,
    rejection_text: reasonText,
  })

  if (!result.success) {
    return {
      success: false,
      error: result.error.issues.map((i) => i.message).join(", "),
    }
  }

  const supabase = await createClient()

  // Verify this ride is assigned to the current driver
  const { data: ride } = await supabase
    .from("rides")
    .select("id, status, driver_id")
    .eq("id", rideId)
    .single()

  if (!ride) {
    return { success: false, error: "Fahrt nicht gefunden" }
  }

  if (ride.driver_id !== auth.driverId) {
    return { success: false, error: "Keine Berechtigung fuer diese Fahrt" }
  }

  if (ride.status !== "planned") {
    return {
      success: false,
      error: "Fahrt kann in diesem Status nicht abgelehnt werden",
    }
  }

  // Update ride status
  const { error } = await supabase
    .from("rides")
    .update({ status: "rejected" })
    .eq("id", rideId)

  if (error) {
    return { success: false, error: error.message }
  }

  // SEC-M9-006: Invalidate all tokens for this ride
  await invalidateTokensForRide(rideId)

  // Resolve acceptance tracking with rejection reason
  await resolveAcceptance(
    rideId,
    "rejected",
    "driver_app",
    result.data.rejection_reason as RejectionReason,
    result.data.rejection_text ?? undefined
  )

  revalidatePath("/my/rides")
  revalidatePath("/dispatch")
  revalidatePath("/rides")
  return { success: true, data: undefined }
}
