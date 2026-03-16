"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/auth/require-admin"

const uuidSchema = z.string().uuid("Ungueltige ID")

interface GdprResult {
  success?: string
  error?: string
}

/**
 * Anonymize all personal data for a patient (GDPR Art. 17).
 * Replaces PII with placeholders, keeps record for statistics/billing.
 * Only callable by admin users.
 */
export async function anonymizePatient(patientId: string): Promise<GdprResult> {
  const auth = await requireAdmin()
  if (!auth.authorized) {
    return { error: auth.error }
  }

  const parsed = uuidSchema.safeParse(patientId)
  if (!parsed.success) {
    return { error: "Ungueltige Patienten-ID" }
  }

  const supabase = createAdminClient()

  const { error } = await supabase.rpc("anonymize_patient", {
    p_patient_id: parsed.data,
  })

  if (error) {
    console.error("[GDPR] anonymize_patient failed:", {
      patientId: parsed.data,
      adminUserId: auth.userId,
      error: error.message,
    })
    // Surface the Postgres exception message for active-rides check
    if (error.message.includes("aktive Fahrten")) {
      return { error: "Patient hat noch aktive Fahrten und kann nicht anonymisiert werden." }
    }
    return { error: "Anonymisierung fehlgeschlagen. Bitte versuchen Sie es erneut." }
  }

  console.info("[GDPR] Patient anonymized:", {
    patientId: parsed.data,
    adminUserId: auth.userId,
    timestamp: new Date().toISOString(),
  })

  revalidatePath("/patients")
  return { success: "Patientendaten wurden anonymisiert." }
}

/**
 * Anonymize all personal data for a driver (GDPR Art. 17).
 * Replaces PII with placeholders, keeps record for statistics/billing.
 * Only callable by admin users.
 */
export async function anonymizeDriver(driverId: string): Promise<GdprResult> {
  const auth = await requireAdmin()
  if (!auth.authorized) {
    return { error: auth.error }
  }

  const parsed = uuidSchema.safeParse(driverId)
  if (!parsed.success) {
    return { error: "Ungueltige Fahrer-ID" }
  }

  const supabase = createAdminClient()

  const { error } = await supabase.rpc("anonymize_driver", {
    p_driver_id: parsed.data,
  })

  if (error) {
    console.error("[GDPR] anonymize_driver failed:", {
      driverId: parsed.data,
      adminUserId: auth.userId,
      error: error.message,
    })
    if (error.message.includes("aktive Fahrten")) {
      return { error: "Fahrer hat noch aktive Fahrten und kann nicht anonymisiert werden." }
    }
    return { error: "Anonymisierung fehlgeschlagen. Bitte versuchen Sie es erneut." }
  }

  console.info("[GDPR] Driver anonymized:", {
    driverId: parsed.data,
    adminUserId: auth.userId,
    timestamp: new Date().toISOString(),
  })

  revalidatePath("/drivers")
  return { success: "Fahrerdaten wurden anonymisiert." }
}
