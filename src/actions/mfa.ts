"use server"

import { createClient } from "@/lib/supabase/server"
import type { ActionResult } from "@/actions/shared"

interface MfaEnrollData {
  factorId: string
  qrCode: string
  secret: string
  uri: string
}

interface MfaStatusData {
  enabled: boolean
  factorId: string | null
}

/**
 * Enroll the current user in TOTP-based MFA.
 * Returns the QR code URI and secret for setup.
 */
export async function enrollMFA(): Promise<ActionResult<MfaEnrollData>> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "Nicht authentifiziert" }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Fahrdienst TOTP",
  })

  if (error) {
    return { success: false, error: `MFA-Registrierung fehlgeschlagen: ${error.message}` }
  }

  return {
    success: true,
    data: {
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
      uri: data.totp.uri,
    },
  }
}

/**
 * Verify a TOTP code to complete MFA enrollment or challenge.
 */
export async function verifyMFA(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient()
  const code = formData.get("code") as string
  const factorId = formData.get("factorId") as string

  if (!code || code.length !== 6) {
    return { success: false, error: "Bitte geben Sie einen 6-stelligen Code ein" }
  }

  if (!factorId) {
    return { success: false, error: "Faktor-ID fehlt" }
  }

  const { data: challengeData, error: challengeError } =
    await supabase.auth.mfa.challenge({ factorId })

  if (challengeError) {
    return { success: false, error: `MFA-Challenge fehlgeschlagen: ${challengeError.message}` }
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challengeData.id,
    code,
  })

  if (verifyError) {
    return { success: false, error: "Ungültiger Code. Bitte erneut versuchen." }
  }

  return { success: true, data: undefined }
}

/**
 * Verify a TOTP code during login (standalone, not form-action based).
 */
export async function verifyMFALogin(
  factorId: string,
  code: string
): Promise<ActionResult> {
  const supabase = await createClient()

  if (!code || code.length !== 6) {
    return { success: false, error: "Bitte geben Sie einen 6-stelligen Code ein" }
  }

  const { data: challengeData, error: challengeError } =
    await supabase.auth.mfa.challenge({ factorId })

  if (challengeError) {
    return { success: false, error: `MFA-Challenge fehlgeschlagen: ${challengeError.message}` }
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challengeData.id,
    code,
  })

  if (verifyError) {
    return { success: false, error: "Ungültiger Code. Bitte erneut versuchen." }
  }

  return { success: true, data: undefined }
}

/**
 * Remove MFA for a given factor.
 */
export async function unenrollMFA(factorId: string): Promise<ActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "Nicht authentifiziert" }
  }

  const { error } = await supabase.auth.mfa.unenroll({ factorId })

  if (error) {
    return { success: false, error: `MFA-Deaktivierung fehlgeschlagen: ${error.message}` }
  }

  return { success: true, data: undefined }
}

/**
 * Get MFA status for the current user.
 */
export async function getMFAStatus(): Promise<ActionResult<MfaStatusData>> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "Nicht authentifiziert" }
  }

  const { data, error } = await supabase.auth.mfa.listFactors()

  if (error) {
    return { success: false, error: `MFA-Status konnte nicht abgefragt werden: ${error.message}` }
  }

  const verifiedFactor = data.totp.find((f) => f.status === "verified")

  return {
    success: true,
    data: {
      enabled: !!verifiedFactor,
      factorId: verifiedFactor?.id ?? null,
    },
  }
}
