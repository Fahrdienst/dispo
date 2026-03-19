"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/require-auth"
import { z } from "zod"
import { zoneSchema, zonePostalCodeSchema } from "@/lib/validations/zones"
import { uuidSchema } from "@/lib/validations/shared"
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
  uuidSchema.parse(id)

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
  uuidSchema.parse(id)

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
  uuidSchema.parse(zoneId)

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
  uuidSchema.parse(postalCodeId)

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

const updatePostalCodeZoneSchema = z.object({
  postalCode: z.string().regex(/^\d{4}$/, "PLZ muss 4-stellig sein"),
  zoneId: z.string().uuid("Ungueltige Zone-ID").nullable(),
})

/**
 * Move a postal code to a different zone, or remove it from all zones.
 * If zoneId is null, the postal code row is deleted (unassigned).
 * If the postal code already belongs to another zone, it is moved.
 */
export async function updatePostalCodeZone(
  postalCode: string,
  zoneId: string | null
): Promise<ActionResult> {
  const auth = await requireAuth(["admin"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const parsed = updatePostalCodeZoneSchema.safeParse({ postalCode, zoneId })
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Ungueltige Eingabe" }
  }

  const supabase = await createClient()

  // Remove existing assignment for this postal code
  const { error: deleteError } = await supabase
    .from("zone_postal_codes")
    .delete()
    .eq("postal_code", parsed.data.postalCode)

  if (deleteError) {
    return { success: false, error: deleteError.message }
  }

  // If a new zone is specified, create the assignment
  if (parsed.data.zoneId) {
    const { error: insertError } = await supabase
      .from("zone_postal_codes")
      .insert({
        zone_id: parsed.data.zoneId,
        postal_code: parsed.data.postalCode,
      })

    if (insertError) {
      return { success: false, error: insertError.message }
    }
  }

  revalidatePath("/settings/zones")
  revalidatePath("/settings/zones/map")
  return { success: true, data: undefined }
}
