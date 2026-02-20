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

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: "Nicht authentifiziert" }
  }

  const raw = Object.fromEntries(formData)
  const result = destinationSchema.safeParse(raw)

  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const { data: destination, error } = await supabase
    .from("destinations")
    .insert(result.data)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Fire-and-forget geocoding (don't block the response)
  if (result.data.street && result.data.house_number && result.data.postal_code && result.data.city) {
    geocodeAndUpdateRecord("destinations", destination.id, {
      street: result.data.street,
      house_number: result.data.house_number,
      postal_code: result.data.postal_code,
      city: result.data.city,
    }).catch((err: unknown) => console.error("Geocoding failed for new destination:", err))
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

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: "Nicht authentifiziert" }
  }

  const raw = Object.fromEntries(formData)
  const result = destinationSchema.safeParse(raw)

  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const { error } = await supabase
    .from("destinations")
    .update(result.data)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Fire-and-forget geocoding (don't block the response)
  if (result.data.street && result.data.house_number && result.data.postal_code && result.data.city) {
    geocodeAndUpdateRecord("destinations", id, {
      street: result.data.street,
      house_number: result.data.house_number,
      postal_code: result.data.postal_code,
      city: result.data.city,
    }).catch((err: unknown) => console.error("Geocoding failed for updated destination:", err))
  }

  revalidatePath("/destinations")
  redirect("/destinations")
}

export async function toggleDestinationActive(
  id: string,
  isActive: boolean
): Promise<ActionResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
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
