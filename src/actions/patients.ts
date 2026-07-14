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
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/types/database"
import type { CostBearer } from "@/lib/patients/constants"

// #125: the generated DB types don't yet include patients.cost_bearer (they are
// regenerated centrally after the M13 merge). Extend the write payload types
// locally so the new column is written type-safely — no `any`, no @ts-ignore.
// Drop these intersections once database.ts is regenerated.
type PatientInsertPayload = TablesInsert<"patients"> & {
  cost_bearer?: CostBearer | null
}
type PatientUpdatePayload = TablesUpdate<"patients"> & {
  cost_bearer?: CostBearer | null
}

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
    .insert(patientData as PatientInsertPayload)
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

  // Fire-and-forget geocoding (don't block the response). House number is
  // optional (KM-14) — facility addresses often have none.
  if (patientData.street && patientData.postal_code && patientData.city) {
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

  // KM-07: only re-geocode when the address actually changed (or was never
  // successfully geocoded). Fetch the current address + status first.
  const { data: existing } = await supabase
    .from("patients")
    .select("street, house_number, postal_code, city, geocode_status")
    .eq("id", id)
    .single()

  const addressChanged =
    !existing ||
    existing.street !== patientData.street ||
    existing.house_number !== patientData.house_number ||
    existing.postal_code !== patientData.postal_code ||
    existing.city !== patientData.city

  const { error } = await supabase
    .from("patients")
    .update(
      // Mark pending on address change so the backfill/cron can recover if the
      // fire-and-forget geocode below fails.
      (addressChanged
        ? { ...patientData, geocode_status: "pending" as const }
        : patientData) as PatientUpdatePayload
    )
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

  // Fire-and-forget geocoding — only when the address changed or was never
  // geocoded (KM-07). House number is optional (KM-14).
  const needsGeocode = addressChanged || existing?.geocode_status !== "success"
  if (needsGeocode && patientData.street && patientData.postal_code && patientData.city) {
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
    .insert(result.data as PatientInsertPayload)
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
