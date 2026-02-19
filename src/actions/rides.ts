"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { rideSchema } from "@/lib/validations/rides"
import { assertTransition } from "@/lib/rides/status-machine"
import type { ActionResult } from "@/actions/shared"
import type { Tables, Enums } from "@/lib/types/database"

export async function createRide(
  _prevState: ActionResult<Tables<"rides">> | null,
  formData: FormData
): Promise<ActionResult<Tables<"rides">>> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: "Nicht authentifiziert" }
  }

  const raw = Object.fromEntries(formData)
  const result = rideSchema.safeParse(raw)

  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    }
  }

  const status: Enums<"ride_status"> = result.data.driver_id
    ? "planned"
    : "unplanned"

  const { data, error } = await supabase
    .from("rides")
    .insert({ ...result.data, status })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/rides")
  redirect(`/rides?date=${result.data.date}`)
}

export async function updateRide(
  id: string,
  _prevState: ActionResult<Tables<"rides">> | null,
  formData: FormData
): Promise<ActionResult<Tables<"rides">>> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: "Nicht authentifiziert" }
  }

  const raw = Object.fromEntries(formData)
  const result = rideSchema.safeParse(raw)

  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    }
  }

  // Fetch current ride to check for auto-transition
  const { data: currentRide } = await supabase
    .from("rides")
    .select("status, driver_id")
    .eq("id", id)
    .single()

  if (!currentRide) {
    return { success: false, error: "Fahrt nicht gefunden" }
  }

  // Auto-transition: unplanned → planned when driver is newly assigned
  const updateData: Record<string, unknown> = { ...result.data }
  if (
    currentRide.status === "unplanned" &&
    !currentRide.driver_id &&
    result.data.driver_id
  ) {
    updateData.status = "planned"
  }

  const { data, error } = await supabase
    .from("rides")
    .update(updateData)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/rides")
  redirect(`/rides?date=${result.data.date}`)
}

export async function updateRideStatus(
  rideId: string,
  newStatus: Enums<"ride_status">
): Promise<ActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: "Nicht authentifiziert" }
  }

  const { data: ride } = await supabase
    .from("rides")
    .select("status")
    .eq("id", rideId)
    .single()

  if (!ride) {
    return { success: false, error: "Fahrt nicht gefunden" }
  }

  try {
    assertTransition(ride.status, newStatus)
  } catch {
    return { success: false, error: "Ungültiger Statusübergang" }
  }

  const { error } = await supabase
    .from("rides")
    .update({ status: newStatus })
    .eq("id", rideId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/rides")
  return { success: true, data: undefined }
}

export async function toggleRideActive(
  id: string,
  isActive: boolean
): Promise<ActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: "Nicht authentifiziert" }
  }

  const { error } = await supabase
    .from("rides")
    .update({ is_active: isActive })
    .eq("id", id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/rides")
  return { success: true, data: undefined }
}
