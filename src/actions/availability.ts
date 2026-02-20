"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/require-auth"
import { weeklyAvailabilitySchema } from "@/lib/validations/availability"
import type { ActionResult } from "@/actions/shared"

/** Compute end_time from start_time (add 2 hours) */
function slotEndTime(startTime: string): string {
  const hour = parseInt(startTime.split(":")[0]!, 10)
  return `${String(hour + 2).padStart(2, "0")}:00`
}

/**
 * Replace-all strategy: delete all weekly slots for a driver,
 * then insert the new set.
 *
 * Callable by:
 * - Staff (admin/operator) for any driver
 * - Driver for their own availability
 */
export async function saveWeeklyAvailability(
  input: { driver_id: string; slots: { day_of_week: string; start_time: string }[] }
): Promise<ActionResult> {
  const auth = await requireAuth()
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const result = weeklyAvailabilitySchema.safeParse(input)
  if (!result.success) {
    const errors = result.error.flatten()
    return {
      success: false,
      error: errors.formErrors[0] ?? "Validierungsfehler",
      fieldErrors: errors.fieldErrors as Record<string, string[]>,
    }
  }

  const { driver_id, slots } = result.data

  // Authorization check: drivers can only manage their own availability
  if (auth.role === "driver" && auth.driverId !== driver_id) {
    return { success: false, error: "Keine Berechtigung fuer diesen Fahrer" }
  }

  const supabase = await createClient()

  // Step 1: Delete all existing weekly slots for this driver
  const { error: deleteError } = await supabase
    .from("driver_availability")
    .delete()
    .eq("driver_id", driver_id)
    .not("day_of_week", "is", null) // only weekly slots, preserve specific_date entries

  if (deleteError) {
    return { success: false, error: deleteError.message }
  }

  // Step 2: Insert new slots
  if (slots.length > 0) {
    const rows = slots.map((slot) => ({
      driver_id,
      day_of_week: slot.day_of_week,
      start_time: slot.start_time,
      end_time: slotEndTime(slot.start_time),
    }))

    const { error: insertError } = await supabase
      .from("driver_availability")
      .insert(rows)

    if (insertError) {
      return { success: false, error: insertError.message }
    }
  }

  revalidatePath(`/drivers/${driver_id}/availability`)
  revalidatePath(`/drivers/${driver_id}`)
  return { success: true, data: undefined }
}
