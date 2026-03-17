"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { rateLimitLogin } from "@/lib/security/rate-limit"
import { trackEvent } from "@/lib/telemetry"
import type { ActionResult } from "@/actions/shared"

interface LoginData {
  mfaRequired?: boolean
  factorId?: string
}

export async function login(
  _prevState: ActionResult<LoginData> | null,
  formData: FormData
): Promise<ActionResult<LoginData>> {
  const supabase = await createClient()

  const email = formData.get("email") as string
  const password = formData.get("password") as string

  if (!email || !password) {
    return { success: false, error: "E-Mail und Passwort sind erforderlich" }
  }

  // Rate limit by email (no reliable IP in Server Actions)
  const limit = rateLimitLogin(email)
  if (!limit.success) {
    return {
      success: false,
      error: "Zu viele Anmeldeversuche. Bitte warten Sie 15 Minuten.",
    }
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    trackEvent({
      event: "login_failed",
      properties: { reason: "invalid_credentials" },
    })
    return { success: false, error: "E-Mail oder Passwort ist falsch" }
  }

  trackEvent({
    event: "login_success",
    userId: data.user?.id,
    properties: { has_mfa: false },
  })

  // Check if MFA is required (AAL2 not yet reached)
  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

  if (
    aalData &&
    aalData.nextLevel === "aal2" &&
    aalData.currentLevel === "aal1"
  ) {
    // Find the TOTP factor to challenge
    const { data: factorsData } = await supabase.auth.mfa.listFactors()
    const totpFactor = factorsData?.totp.find((f) => f.status === "verified")

    if (totpFactor) {
      trackEvent({
        event: "login_mfa_required",
        userId: data.user?.id,
        properties: { factor_type: "totp" },
      })
      return {
        success: true,
        data: { mfaRequired: true, factorId: totpFactor.id },
      }
    }
  }

  // Suppress unused variable warning — data is checked by the MFA flow above
  void data

  redirect("/")
}

export async function logout(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}
