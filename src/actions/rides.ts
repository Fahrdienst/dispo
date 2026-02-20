"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/require-auth"
import {
  rideSchema,
  addMinutesToTime,
  DEFAULT_RETURN_BUFFER_MINUTES,
} from "@/lib/validations/rides"
import { assertTransitionForRole } from "@/lib/rides/status-machine"
import type { ActionResult } from "@/actions/shared"
import type { Tables, Enums } from "@/lib/types/database"

export async function createRide(
  _prevState: ActionResult<Tables<"rides">> | null,
  formData: FormData
): Promise<ActionResult<Tables<"rides">>> {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
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

  const { create_return_ride, ...rideData } = result.data
  const status: Enums<"ride_status"> = rideData.driver_id
    ? "planned"
    : "unplanned"

  const supabase = await createClient()

  // 1. Create the outbound ride
  const { data: outboundRide, error } = await supabase
    .from("rides")
    .insert({ ...rideData, status })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // 2. Optionally create return ride
  if (create_return_ride && rideData.direction === "outbound") {
    const returnPickupTime =
      rideData.return_pickup_time ??
      (rideData.appointment_end_time
        ? addMinutesToTime(
            rideData.appointment_end_time,
            DEFAULT_RETURN_BUFFER_MINUTES
          )
        : null)

    if (returnPickupTime) {
      const { error: returnError } = await supabase.from("rides").insert({
        patient_id: rideData.patient_id,
        destination_id: rideData.destination_id,
        date: rideData.date,
        pickup_time: returnPickupTime,
        direction: "return" as const,
        status: "unplanned" as const,
        parent_ride_id: outboundRide.id,
      })

      if (returnError) {
        // Outbound ride was created successfully. Log return ride error
        // but still redirect -- the dispatcher can create it manually.
        console.error("Failed to create return ride:", returnError.message)
      }
    }
  }

  revalidatePath("/rides")
  revalidatePath("/dispatch")
  redirect(`/rides?date=${rideData.date}`)
}

export async function updateRide(
  id: string,
  _prevState: ActionResult<Tables<"rides">> | null,
  formData: FormData
): Promise<ActionResult<Tables<"rides">>> {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
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

  // Strip transient field before DB update
  const { create_return_ride: _, ...rideData } = result.data

  const supabase = await createClient()

  // Fetch current ride to check for auto-transition
  const { data: currentRide } = await supabase
    .from("rides")
    .select("status, driver_id")
    .eq("id", id)
    .single()

  if (!currentRide) {
    return { success: false, error: "Fahrt nicht gefunden" }
  }

  // Auto-transition: unplanned -> planned when driver is newly assigned
  const updateData: Record<string, unknown> = { ...rideData }
  if (
    currentRide.status === "unplanned" &&
    !currentRide.driver_id &&
    rideData.driver_id
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
  revalidatePath("/dispatch")
  redirect(`/rides?date=${rideData.date}`)
}

export async function updateRideStatus(
  rideId: string,
  newStatus: Enums<"ride_status">
): Promise<ActionResult> {
  const auth = await requireAuth()
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const supabase = await createClient()
  const { data: ride } = await supabase
    .from("rides")
    .select("status, driver_id")
    .eq("id", rideId)
    .single()

  if (!ride) {
    return { success: false, error: "Fahrt nicht gefunden" }
  }

  // Drivers can only update status on their own assigned rides
  if (auth.role === "driver" && ride.driver_id !== auth.driverId) {
    return { success: false, error: "Keine Berechtigung für diese Fahrt" }
  }

  try {
    assertTransitionForRole(ride.status, newStatus, auth.role)
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
  revalidatePath("/my/rides")
  return { success: true, data: undefined }
}

export async function assignDriver(
  rideId: string,
  driverId: string | null
): Promise<ActionResult> {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const supabase = await createClient()

  // Fetch current ride to check for auto-transition
  const { data: currentRide } = await supabase
    .from("rides")
    .select("status, driver_id")
    .eq("id", rideId)
    .single()

  if (!currentRide) {
    return { success: false, error: "Fahrt nicht gefunden" }
  }

  // Build update payload
  const updateData: {
    driver_id: string | null
    status?: Enums<"ride_status">
  } = {
    driver_id: driverId,
  }

  // Auto-transition: unplanned -> planned when driver is newly assigned
  if (
    currentRide.status === "unplanned" &&
    !currentRide.driver_id &&
    driverId
  ) {
    updateData.status = "planned"
  }

  // Auto-transition: planned -> unplanned when driver is removed
  if (
    currentRide.status === "planned" &&
    currentRide.driver_id &&
    !driverId
  ) {
    updateData.status = "unplanned"
  }

  const { error } = await supabase
    .from("rides")
    .update(updateData)
    .eq("id", rideId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/dispatch")
  revalidatePath("/rides")
  revalidatePath("/my/rides")
  return { success: true, data: undefined }
}

export async function toggleRideActive(
  id: string,
  isActive: boolean
): Promise<ActionResult> {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const supabase = await createClient()
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
