"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/require-admin"
import { updateOrganizationSchema } from "@/lib/validations/organization"
import type { ActionResult } from "@/actions/shared"

// =============================================================================
// TYPES (not in auto-generated DB types yet — run db:types after migration)
// =============================================================================

export interface OrganizationSettings {
  id: string
  org_name: string
  org_street: string | null
  org_postal_code: string | null
  org_city: string | null
  org_country: string
  org_phone: string | null
  org_email: string | null
  org_website: string | null
  logo_url: string | null
  primary_color: string
  secondary_color: string
  email_enabled: boolean
  sms_enabled: boolean
  email_from_name: string
  email_from_address: string | null
  created_at: string
  updated_at: string
}

// =============================================================================
// GET ORGANIZATION SETTINGS
// =============================================================================

export async function getOrganizationSettings(): Promise<OrganizationSettings | null> {
  const supabase = await createClient()

const { data, error } = await (supabase as any)
    .from("organization_settings")
    .select("*")
    .limit(1)
    .single()

  if (error || !data) {
    return null
  }

  return data as OrganizationSettings
}

// =============================================================================
// UPDATE ORGANIZATION SETTINGS
// =============================================================================

export async function updateOrganizationSettings(
  _prevState: ActionResult<OrganizationSettings> | null,
  formData: FormData
): Promise<ActionResult<OrganizationSettings>> {
  const auth = await requireAdmin()
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const raw = Object.fromEntries(formData)
  const result = updateOrganizationSchema.safeParse(raw)

  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const supabase = await createClient()

  // Get singleton row
const { data: current } = await (supabase as any)
    .from("organization_settings")
    .select("id")
    .limit(1)
    .single()

  if (!current) {
    return { success: false, error: "Organisationseinstellungen nicht gefunden" }
  }

const { data, error } = await (supabase as any)
    .from("organization_settings")
    .update(result.data)
    .eq("id", current.id)
    .select()
    .single()

  if (error) {
    console.error("Failed to update organization settings:", error)
    return { success: false, error: "Einstellungen konnten nicht gespeichert werden" }
  }

  revalidatePath("/settings")
  return { success: true, data: data as OrganizationSettings }
}

// =============================================================================
// UPLOAD LOGO
// =============================================================================

export async function uploadOrganizationLogo(
  formData: FormData
): Promise<ActionResult<{ logo_url: string }>> {
  const auth = await requireAdmin()
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const file = formData.get("logo") as File | null
  if (!file) {
    return { success: false, error: "Keine Datei ausgewählt" }
  }

  const maxSize = 2 * 1024 * 1024
  if (file.size > maxSize) {
    return { success: false, error: "Die Datei darf maximal 2 MB gross sein" }
  }

  const allowedTypes = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"]
  if (!allowedTypes.includes(file.type)) {
    return { success: false, error: "Nur PNG, JPEG, SVG und WebP Dateien sind erlaubt" }
  }

  const supabase = await createClient()
  const ext = file.name.split(".").pop() || "png"
  const fileName = `logo.${ext}`

  const { error: uploadError } = await supabase.storage
    .from("organization")
    .upload(fileName, file, { upsert: true, contentType: file.type })

  if (uploadError) {
    console.error("Logo upload failed:", uploadError)
    return { success: false, error: "Fehler beim Hochladen des Logos" }
  }

  const { data: urlData } = supabase.storage
    .from("organization")
    .getPublicUrl(fileName)

  // Update settings
const { data: current } = await (supabase as any)
    .from("organization_settings")
    .select("id")
    .limit(1)
    .single()

  if (current) {
    await (supabase as any)
      .from("organization_settings")
      .update({ logo_url: urlData.publicUrl })
      .eq("id", current.id)
  }

  revalidatePath("/settings")
  return { success: true, data: { logo_url: urlData.publicUrl } }
}

// =============================================================================
// DELETE LOGO
// =============================================================================

export async function deleteOrganizationLogo(): Promise<ActionResult> {
  const auth = await requireAdmin()
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const supabase = await createClient()

const { data: settings } = await (supabase as any)
    .from("organization_settings")
    .select("id, logo_url")
    .limit(1)
    .single()

  if (!settings?.logo_url) {
    return { success: false, error: "Kein Logo vorhanden" }
  }

  try {
    const url = new URL(settings.logo_url)
    const pathParts = url.pathname.split("/")
    const fileName = pathParts[pathParts.length - 1] ?? ""
    if (fileName) {
      await supabase.storage.from("organization").remove([fileName])
    }
  } catch {
    // Ignore storage delete errors
  }

await (supabase as any)
    .from("organization_settings")
    .update({ logo_url: null })
    .eq("id", settings.id)

  revalidatePath("/settings")
  return { success: true, data: undefined }
}
