"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/require-auth"
import { fareVersionSchema, fareRuleSchema } from "@/lib/validations/fares"
import type { ActionResult } from "@/actions/shared"
import type { Tables } from "@/lib/types/database"

// ============================================================
// Fare Versions
// ============================================================

export async function createFareVersion(
  _prevState: ActionResult<Tables<"fare_versions">> | null,
  formData: FormData
): Promise<ActionResult<Tables<"fare_versions">>> {
  const auth = await requireAuth(["admin"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const raw = Object.fromEntries(formData)
  const result = fareVersionSchema.safeParse(raw)

  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("fare_versions")
    .insert(result.data)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/settings/fares")
  redirect(`/settings/fares/${data.id}/edit`)
}

export async function updateFareVersion(
  id: string,
  _prevState: ActionResult<Tables<"fare_versions">> | null,
  formData: FormData
): Promise<ActionResult<Tables<"fare_versions">>> {
  const auth = await requireAuth(["admin"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const raw = Object.fromEntries(formData)
  const result = fareVersionSchema.safeParse(raw)

  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("fare_versions")
    .update(result.data)
    .eq("id", id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/settings/fares")
  return { success: true, data: undefined as unknown as Tables<"fare_versions"> }
}

export async function toggleFareVersionActive(
  id: string,
  isActive: boolean
): Promise<ActionResult> {
  const auth = await requireAuth(["admin"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("fare_versions")
    .update({ is_active: isActive })
    .eq("id", id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/settings/fares")
  return { success: true, data: undefined }
}

// ============================================================
// Fare Rules
// ============================================================

export async function createFareRule(
  fareVersionId: string,
  _prevState: ActionResult<Tables<"fare_rules">> | null,
  formData: FormData
): Promise<ActionResult<Tables<"fare_rules">>> {
  const auth = await requireAuth(["admin"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const raw = Object.fromEntries(formData)
  const result = fareRuleSchema.safeParse(raw)

  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.from("fare_rules").insert({
    fare_version_id: fareVersionId,
    from_zone_id: result.data.from_zone_id,
    to_zone_id: result.data.to_zone_id,
    base_price: result.data.base_price,
    price_per_km: result.data.price_per_km,
  })

  if (error) {
    if (error.code === "23505") {
      return {
        success: false,
        error: "Eine Tarifregel fuer diese Zonenkombination existiert bereits.",
      }
    }
    return { success: false, error: error.message }
  }

  revalidatePath("/settings/fares")
  return { success: true, data: undefined as unknown as Tables<"fare_rules"> }
}

export async function updateFareRule(
  ruleId: string,
  _prevState: ActionResult<Tables<"fare_rules">> | null,
  formData: FormData
): Promise<ActionResult<Tables<"fare_rules">>> {
  const auth = await requireAuth(["admin"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const raw = Object.fromEntries(formData)
  const result = fareRuleSchema.safeParse(raw)

  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("fare_rules")
    .update({
      from_zone_id: result.data.from_zone_id,
      to_zone_id: result.data.to_zone_id,
      base_price: result.data.base_price,
      price_per_km: result.data.price_per_km,
    })
    .eq("id", ruleId)

  if (error) {
    if (error.code === "23505") {
      return {
        success: false,
        error: "Eine Tarifregel fuer diese Zonenkombination existiert bereits.",
      }
    }
    return { success: false, error: error.message }
  }

  revalidatePath("/settings/fares")
  return { success: true, data: undefined as unknown as Tables<"fare_rules"> }
}

export async function deleteFareRule(ruleId: string): Promise<ActionResult> {
  const auth = await requireAuth(["admin"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("fare_rules")
    .delete()
    .eq("id", ruleId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/settings/fares")
  return { success: true, data: undefined }
}
