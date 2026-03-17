"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/require-auth"
import { uuidSchema } from "@/lib/validations/shared"
import { z } from "zod"
import type { ActionResult } from "@/actions/shared"

const problemMessageSchema = z
  .string()
  .min(1, "Nachricht darf nicht leer sein")
  .max(2000, "Nachricht zu lang (max. 2000 Zeichen)")

/**
 * Report a problem for a ride. Creates a communication_log entry
 * without changing the ride status.
 * Only drivers assigned to the ride can report problems.
 */
export async function reportRideProblem(
  rideId: string,
  message: string
): Promise<ActionResult> {
  const parsedId = uuidSchema.safeParse(rideId)
  if (!parsedId.success) {
    return { success: false, error: "Ungueltige Fahrt-ID" }
  }

  const parsedMessage = problemMessageSchema.safeParse(message)
  if (!parsedMessage.success) {
    return {
      success: false,
      error: parsedMessage.error.issues[0]?.message ?? "Ungueltige Nachricht",
    }
  }

  const auth = await requireAuth(["driver"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const supabase = await createClient()

  // Verify the ride is assigned to this driver
  const { data: ride } = await supabase
    .from("rides")
    .select("driver_id")
    .eq("id", parsedId.data)
    .single()

  if (!ride) {
    return { success: false, error: "Fahrt nicht gefunden" }
  }

  if (ride.driver_id !== auth.driverId) {
    return { success: false, error: "Keine Berechtigung fuer diese Fahrt" }
  }

  const { error } = await supabase.from("communication_log").insert({
    ride_id: parsedId.data,
    message: `[PROBLEM] ${parsedMessage.data}`,
    author_id: auth.userId,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(`/rides/${rideId}`)
  revalidatePath("/my/rides")
  return { success: true, data: undefined }
}
