"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { driverSchema } from "@/lib/validations/drivers"
import type { ActionResult } from "@/actions/shared"
import type { Tables } from "@/lib/types/database"

export async function createDriver(
  _prevState: ActionResult<Tables<"drivers">> | null,
  formData: FormData
): Promise<ActionResult<Tables<"drivers">>> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: "Nicht authentifiziert" }
  }

  const raw = Object.fromEntries(formData)
  const result = driverSchema.safeParse(raw)

  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const { data, error } = await supabase
    .from("drivers")
    .insert(result.data)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/drivers")
  redirect("/drivers")
}

export async function updateDriver(
  id: string,
  _prevState: ActionResult<Tables<"drivers">> | null,
  formData: FormData
): Promise<ActionResult<Tables<"drivers">>> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: "Nicht authentifiziert" }
  }

  const raw = Object.fromEntries(formData)
  const result = driverSchema.safeParse(raw)

  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const { data, error } = await supabase
    .from("drivers")
    .update(result.data)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/drivers")
  redirect("/drivers")
}

export async function toggleDriverActive(
  id: string,
  isActive: boolean
): Promise<ActionResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: "Nicht authentifiziert" }
  }

  const { error } = await supabase
    .from("drivers")
    .update({ is_active: isActive })
    .eq("id", id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/drivers")
  return { success: true, data: undefined }
}
