"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/auth/require-admin"
import { createUserSchema, updateUserSchema } from "@/lib/validations/users"
import type { ActionResult } from "@/actions/shared"
import type { Tables } from "@/lib/types/database"

export async function createUser(
  _prevState: ActionResult<Tables<"profiles">> | null,
  formData: FormData
): Promise<ActionResult<Tables<"profiles">>> {
  const auth = await requireAdmin()
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const raw = Object.fromEntries(formData)
  // Normalize empty driver_id to null before validation
  if (raw.driver_id === "") {
    raw.driver_id = null as unknown as string
  }
  const result = createUserSchema.safeParse(raw)

  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const { email, password, display_name, role, driver_id } = result.data

  // Create auth user via admin client
  const adminClient = createAdminClient()
  const { data: authData, error: authError } =
    await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name },
    })

  if (authError) {
    console.error("Failed to create auth user:", authError)
    if (authError.message.includes("already been registered")) {
      return { success: false, error: "Diese E-Mail-Adresse wird bereits verwendet" }
    }
    return { success: false, error: "Benutzer konnte nicht erstellt werden" }
  }

  // Update profile (trigger creates it with role=operator, we correct it)
  const supabase = await createClient()
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      role,
      display_name,
      driver_id: driver_id ?? null,
    })
    .eq("id", authData.user.id)

  if (profileError) {
    console.error("Failed to update profile:", profileError)
    return { success: false, error: "Profil konnte nicht aktualisiert werden" }
  }

  revalidatePath("/users")
  redirect("/users")
}

export async function updateUser(
  id: string,
  _prevState: ActionResult<Tables<"profiles">> | null,
  formData: FormData
): Promise<ActionResult<Tables<"profiles">>> {
  const auth = await requireAdmin()
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const raw = Object.fromEntries(formData)
  // Normalize empty driver_id to null before validation
  if (raw.driver_id === "") {
    raw.driver_id = null as unknown as string
  }
  const result = updateUserSchema.safeParse(raw)

  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const { display_name, role, driver_id } = result.data

  // Self-demotion check
  if (id === auth.userId) {
    const supabase = await createClient()
    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", id)
      .single()

    if (currentProfile && currentProfile.role !== role) {
      return {
        success: false,
        error: "Sie können Ihre eigene Rolle nicht ändern",
      }
    }
  }

  // Last-admin check
  if (role !== "admin") {
    const supabase = await createClient()
    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", id)
      .single()

    if (currentProfile?.role === "admin") {
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin")
        .eq("is_active", true)

      if ((count ?? 0) <= 1) {
        return {
          success: false,
          error: "Der letzte Administrator kann nicht herabgestuft werden",
        }
      }
    }
  }

  // Clear driver_id if role changed away from driver
  const supabase = await createClient()
  const { error } = await supabase
    .from("profiles")
    .update({
      role,
      display_name,
      driver_id: role === "driver" ? (driver_id ?? null) : null,
    })
    .eq("id", id)

  if (error) {
    console.error("Failed to update user:", error)
    return { success: false, error: "Benutzer konnte nicht aktualisiert werden" }
  }

  revalidatePath("/users")
  redirect("/users")
}

export async function toggleUserActive(
  id: string,
  isActive: boolean
): Promise<ActionResult> {
  const auth = await requireAdmin()
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  // Self-deactivation check
  if (id === auth.userId && !isActive) {
    return {
      success: false,
      error: "Sie können Ihr eigenes Konto nicht deaktivieren",
    }
  }

  // Last-admin check when deactivating
  if (!isActive) {
    const supabase = await createClient()
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", id)
      .single()

    if (profile?.role === "admin") {
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin")
        .eq("is_active", true)

      if ((count ?? 0) <= 1) {
        return {
          success: false,
          error: "Der letzte Administrator kann nicht deaktiviert werden",
        }
      }
    }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", id)

  if (error) {
    console.error("Failed to toggle user active:", error)
    return { success: false, error: "Status konnte nicht geändert werden" }
  }

  // Revoke sessions when deactivating
  if (!isActive) {
    try {
      const adminClient = createAdminClient()
      await adminClient.auth.admin.signOut(id)
    } catch (e) {
      console.error("Failed to revoke user sessions:", e)
    }
  }

  revalidatePath("/users")
  return { success: true, data: undefined }
}
