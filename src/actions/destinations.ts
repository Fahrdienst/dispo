"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { destinationSchema } from "@/lib/validations/destinations"
import { geocodeAndUpdateRecord } from "@/lib/maps/geocode"
import type { ActionResult } from "@/actions/shared"
import type { Tables } from "@/lib/types/database"

export async function createDestination(
  _prevState: ActionResult<Tables<"destinations">> | null,
  formData: FormData
): Promise<ActionResult<Tables<"destinations">>> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: "Nicht authentifiziert" }
  }

  const raw = Object.fromEntries(formData)
  const result = destinationSchema.safeParse(raw)

  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    }
  }

  // Separate geo fields from the main form data
  const { place_id, lat, lng, formatted_address, ...destinationData } =
    result.data

  // If we have geo data from Places, include it directly in the insert
  const hasGeoData = lat != null && lng != null && place_id
  const insertData = hasGeoData
    ? {
        ...destinationData,
        place_id,
        lat,
        lng,
        formatted_address,
        geocode_status: "success" as const,
        geocode_updated_at: new Date().toISOString(),
      }
    : destinationData

  const { data: destination, error } = await supabase
    .from("destinations")
    .insert(insertData)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Fire-and-forget geocoding only when no coordinates came from Places
  if (
    !hasGeoData &&
    destinationData.street &&
    destinationData.house_number &&
    destinationData.postal_code &&
    destinationData.city
  ) {
    geocodeAndUpdateRecord("destinations", destination.id, {
      street: destinationData.street,
      house_number: destinationData.house_number,
      postal_code: destinationData.postal_code,
      city: destinationData.city,
    }).catch((err: unknown) =>
      console.error("Geocoding failed for new destination:", err)
    )
  }

  revalidatePath("/destinations")
  redirect("/destinations")
}

export async function updateDestination(
  id: string,
  _prevState: ActionResult<Tables<"destinations">> | null,
  formData: FormData
): Promise<ActionResult<Tables<"destinations">>> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: "Nicht authentifiziert" }
  }

  const raw = Object.fromEntries(formData)
  const result = destinationSchema.safeParse(raw)

  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    }
  }

  // Separate geo fields from the main form data
  const { place_id, lat, lng, formatted_address, ...destinationData } =
    result.data

  // If we have geo data from Places, include it directly in the update
  const hasGeoData = lat != null && lng != null && place_id
  const updateData = hasGeoData
    ? {
        ...destinationData,
        place_id,
        lat,
        lng,
        formatted_address,
        geocode_status: "success" as const,
        geocode_updated_at: new Date().toISOString(),
      }
    : destinationData

  const { error } = await supabase
    .from("destinations")
    .update(updateData)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Fire-and-forget geocoding only when no coordinates came from Places
  if (
    !hasGeoData &&
    destinationData.street &&
    destinationData.house_number &&
    destinationData.postal_code &&
    destinationData.city
  ) {
    geocodeAndUpdateRecord("destinations", id, {
      street: destinationData.street,
      house_number: destinationData.house_number,
      postal_code: destinationData.postal_code,
      city: destinationData.city,
    }).catch((err: unknown) =>
      console.error("Geocoding failed for updated destination:", err)
    )
  }

  revalidatePath("/destinations")
  redirect("/destinations")
}

export async function toggleDestinationActive(
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
    .from("destinations")
    .update({ is_active: isActive })
    .eq("id", id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/destinations")
  return { success: true, data: undefined }
}
