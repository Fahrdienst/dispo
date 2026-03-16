"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/require-auth"
import { driverSchema } from "@/lib/validations/drivers"
import { logAudit } from "@/lib/audit/logger"
import { uuidSchema } from "@/lib/validations/shared"
import type { ActionResult } from "@/actions/shared"
import type { Tables } from "@/lib/types/database"

export async function createDriver(
  _prevState: ActionResult<Tables<"drivers">> | null,
  formData: FormData
): Promise<ActionResult<Tables<"drivers">>> {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const raw = Object.fromEntries(formData)
  const result = driverSchema.safeParse(raw)

  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("drivers")
    .insert(result.data)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Fire-and-forget audit log
  logAudit({
    userId: auth.userId,
    userRole: auth.role,
    action: "create",
    entityType: "driver",
    entityId: data.id,
  }).catch(() => {})

  revalidatePath("/drivers")
  redirect("/drivers")
}

export async function updateDriver(
  id: string,
  _prevState: ActionResult<Tables<"drivers">> | null,
  formData: FormData
): Promise<ActionResult<Tables<"drivers">>> {
  uuidSchema.parse(id)

  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const raw = Object.fromEntries(formData)
  const result = driverSchema.safeParse(raw)

  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("drivers")
    .update(result.data)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Fire-and-forget audit log
  logAudit({
    userId: auth.userId,
    userRole: auth.role,
    action: "update",
    entityType: "driver",
    entityId: id,
    metadata: { fields: Object.keys(result.data) },
  }).catch(() => {})

  revalidatePath("/drivers")
  redirect("/drivers")
}

export async function toggleDriverActive(
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
    .from("drivers")
    .update({ is_active: isActive })
    .eq("id", id)

  if (error) {
    return { success: false, error: error.message }
  }

  // Fire-and-forget audit log
  logAudit({
    userId: auth.userId,
    userRole: auth.role,
    action: isActive ? "activate" : "deactivate",
    entityType: "driver",
    entityId: id,
    changes: { is_active: { old: !isActive, new: isActive } },
  }).catch(() => {})

  revalidatePath("/drivers")
  return { success: true, data: undefined }
}
