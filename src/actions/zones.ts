"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/require-auth"
import { zoneSchema, zonePostalCodeSchema } from "@/lib/validations/zones"
import type { ActionResult } from "@/actions/shared"
import type { Tables } from "@/lib/types/database"

export async function createZone(
  _prevState: ActionResult<Tables<"zones">> | null,
  formData: FormData
): Promise<ActionResult<Tables<"zones">>> {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const raw = Object.fromEntries(formData)
  const result = zoneSchema.safeParse(raw)

  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("zones")
    .insert(result.data)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/settings/zones")
  redirect(`/settings/zones/${data.id}/edit`)
}

export async function updateZone(
  id: string,
  _prevState: ActionResult<Tables<"zones">> | null,
  formData: FormData
): Promise<ActionResult<Tables<"zones">>> {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const raw = Object.fromEntries(formData)
  const result = zoneSchema.safeParse(raw)

  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("zones")
    .update(result.data)
    .eq("id", id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/settings/zones")
  return { success: true, data: undefined as unknown as Tables<"zones"> }
}

export async function toggleZoneActive(
  id: string,
  isActive: boolean
): Promise<ActionResult> {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("zones")
    .update({ is_active: isActive })
    .eq("id", id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/settings/zones")
  return { success: true, data: undefined }
}

export async function addPostalCodesToZone(
  zoneId: string,
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const rawInput = formData.get("postal_codes") as string | null
  if (!rawInput || rawInput.trim() === "") {
    return { success: false, error: "Mindestens eine PLZ eingeben" }
  }

  // Accept comma-separated or space-separated postal codes
  const codes = rawInput
    .split(/[\s,;]+/)
    .map((c) => c.trim())
    .filter((c) => c.length > 0)

  // Validate each postal code
  const invalidCodes: string[] = []
  for (const code of codes) {
    const result = zonePostalCodeSchema.safeParse({ postal_code: code })
    if (!result.success) {
      invalidCodes.push(code)
    }
  }

  if (invalidCodes.length > 0) {
    return {
      success: false,
      error: `Ungueltige PLZ: ${invalidCodes.join(", ")}. PLZ muss 4-stellig sein.`,
    }
  }

  const supabase = await createClient()

  // Insert all codes (upsert-like: skip duplicates via unique constraint)
  const rows = codes.map((postal_code) => ({
    zone_id: zoneId,
    postal_code,
  }))

  const { error } = await supabase.from("zone_postal_codes").insert(rows)

  if (error) {
    // Check for unique constraint violation
    if (error.code === "23505") {
      return {
        success: false,
        error: "Eine oder mehrere PLZ sind bereits einer Zone zugeordnet.",
      }
    }
    return { success: false, error: error.message }
  }

  revalidatePath("/settings/zones")
  return { success: true, data: undefined }
}

export async function removePostalCodeFromZone(
  postalCodeId: string
): Promise<ActionResult> {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("zone_postal_codes")
    .delete()
    .eq("id", postalCodeId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/settings/zones")
  return { success: true, data: undefined }
}
