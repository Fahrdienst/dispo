"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/require-auth"
import { communicationLogSchema } from "@/lib/validations/communication-log"
import type { ActionResult } from "@/actions/shared"

export async function addMessage(
  rideId: string,
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const auth = await requireAuth()
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const raw = {
    ride_id: rideId,
    message: formData.get("message"),
  }

  const result = communicationLogSchema.safeParse(raw)
  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    }
  }

  const supabase = await createClient()

  // Drivers can only add messages to their own assigned rides
  if (auth.role === "driver") {
    const { data: ride } = await supabase
      .from("rides")
      .select("driver_id")
      .eq("id", rideId)
      .single()

    if (!ride || ride.driver_id !== auth.driverId) {
      return { success: false, error: "Keine Berechtigung fuer diese Fahrt" }
    }
  }

  const { error } = await supabase.from("communication_log").insert({
    ride_id: result.data.ride_id,
    message: result.data.message,
    author_id: auth.userId,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(`/rides/${rideId}`)
  return { success: true, data: undefined }
}
