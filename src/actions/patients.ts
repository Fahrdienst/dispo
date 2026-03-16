"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { patientSchema, patientInlineSchema } from "@/lib/validations/patients"
import { requireAuth } from "@/lib/auth/require-auth"
import { geocodeAndUpdateRecord } from "@/lib/maps/geocode"
import { logAudit } from "@/lib/audit/logger"
import { uuidSchema } from "@/lib/validations/shared"
import type { ActionResult } from "@/actions/shared"
import type { Tables } from "@/lib/types/database"

export async function createPatient(
  _prevState: ActionResult<Tables<"patients">> | null,
  formData: FormData
): Promise<ActionResult<Tables<"patients">>> {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const impairments = formData.getAll("impairments") as string[]
  const raw = { ...Object.fromEntries(formData), impairments }
  const result = patientSchema.safeParse(raw)

  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const { impairments: validatedImpairments, ...patientData } = result.data

  const supabase = await createClient()
  const { data: patient, error } = await supabase
    .from("patients")
    .insert(patientData)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  if (validatedImpairments.length > 0 && patient) {
    const { error: impError } = await supabase
      .from("patient_impairments")
      .insert(
        validatedImpairments.map((type) => ({
          patient_id: patient.id,
          impairment_type: type,
        }))
      )

    if (impError) {
      return { success: false, error: impError.message }
    }
  }

  // Fire-and-forget audit log
  logAudit({
    userId: auth.userId,
    userRole: auth.role,
    action: "create",
    entityType: "patient",
    entityId: patient.id,
  }).catch(() => {})

  // Fire-and-forget geocoding (don't block the response)
  if (patientData.street && patientData.house_number && patientData.postal_code && patientData.city) {
    geocodeAndUpdateRecord("patients", patient.id, {
      street: patientData.street,
      house_number: patientData.house_number,
      postal_code: patientData.postal_code,
      city: patientData.city,
    }).catch((err: unknown) => console.error("Geocoding failed for new patient:", err))
  }

  revalidatePath("/patients")
  redirect("/patients")
}

export async function updatePatient(
  id: string,
  _prevState: ActionResult<Tables<"patients">> | null,
  formData: FormData
): Promise<ActionResult<Tables<"patients">>> {
  uuidSchema.parse(id)

  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const impairments = formData.getAll("impairments") as string[]
  const raw = { ...Object.fromEntries(formData), impairments }
  const result = patientSchema.safeParse(raw)

  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const { impairments: validatedImpairments, ...patientData } = result.data

  const supabase = await createClient()
  const { error } = await supabase
    .from("patients")
    .update(patientData)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Replace-all strategy: delete existing, then insert new
  const { error: deleteError } = await supabase
    .from("patient_impairments")
    .delete()
    .eq("patient_id", id)

  if (deleteError) {
    return { success: false, error: deleteError.message }
  }

  if (validatedImpairments.length > 0) {
    const { error: impError } = await supabase
      .from("patient_impairments")
      .insert(
        validatedImpairments.map((type) => ({
          patient_id: id,
          impairment_type: type,
        }))
      )

    if (impError) {
      return { success: false, error: impError.message }
    }
  }

  // Fire-and-forget audit log
  logAudit({
    userId: auth.userId,
    userRole: auth.role,
    action: "update",
    entityType: "patient",
    entityId: id,
    metadata: { fields: Object.keys(patientData) },
  }).catch(() => {})

  // Fire-and-forget geocoding (don't block the response)
  if (patientData.street && patientData.house_number && patientData.postal_code && patientData.city) {
    geocodeAndUpdateRecord("patients", id, {
      street: patientData.street,
      house_number: patientData.house_number,
      postal_code: patientData.postal_code,
      city: patientData.city,
    }).catch((err: unknown) => console.error("Geocoding failed for updated patient:", err))
  }

  revalidatePath("/patients")
  redirect("/patients")
}

export async function createPatientInline(
  _prevState: ActionResult<Tables<"patients">> | null,
  formData: FormData
): Promise<ActionResult<Tables<"patients">>> {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const raw = Object.fromEntries(formData)
  const result = patientInlineSchema.safeParse(raw)

  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const supabase = await createClient()
  const { data: patient, error } = await supabase
    .from("patients")
    .insert(result.data)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Fire-and-forget geocoding
  if (result.data.street && result.data.house_number && result.data.postal_code && result.data.city) {
    geocodeAndUpdateRecord("patients", patient.id, {
      street: result.data.street,
      house_number: result.data.house_number,
      postal_code: result.data.postal_code,
      city: result.data.city,
    }).catch((err: unknown) => console.error("Geocoding failed for inline patient:", err))
  }

  revalidatePath("/patients")
  revalidatePath("/rides")
  return { success: true, data: patient }
}

export async function togglePatientActive(
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
    .from("patients")
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
    entityType: "patient",
    entityId: id,
    changes: { is_active: { old: !isActive, new: isActive } },
  }).catch(() => {})

  revalidatePath("/patients")
  return { success: true, data: undefined }
}
