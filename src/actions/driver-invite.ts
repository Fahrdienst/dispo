"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/auth/require-admin"
import { logAudit } from "@/lib/audit/logger"
import { forgotPasswordSchema } from "@/lib/validations/auth"
import { uuidSchema } from "@/lib/validations/shared"
import type { ActionResult } from "@/actions/shared"

/**
 * Invitation state of a driver, derived from the linked profile + auth user.
 * There is intentionally no dedicated DB column (this slice owns no migrations);
 * the state is reconstructed from existing data on demand.
 */
export type DriverInviteStatus =
  | { state: "none" }
  | { state: "invited"; email: string; invitedAt: string | null }
  | { state: "active"; email: string; lastSignInAt: string | null }

/**
 * Returns the invitation status for a driver. Admin-only.
 *
 *  - "none"    -> no profile is linked to this driver yet
 *  - "invited" -> a linked user exists but has never signed in
 *  - "active"  -> a linked user exists and has signed in at least once
 */
export async function getDriverInviteStatus(
  driverId: string
): Promise<ActionResult<DriverInviteStatus>> {
  const parsed = uuidSchema.safeParse(driverId)
  if (!parsed.success) {
    return { success: false, error: "Ungültige Fahrer-ID" }
  }

  const auth = await requireAdmin()
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("driver_id", driverId)
    .maybeSingle()

  if (!profile) {
    return { success: true, data: { state: "none" } }
  }

  // Read auth-user metadata (invited_at / last_sign_in_at) via the admin client.
  const adminClient = createAdminClient()
  const { data: userData, error } = await adminClient.auth.admin.getUserById(
    profile.id
  )

  if (error || !userData.user) {
    // Profile exists but auth user is unreadable — surface as invited so the
    // admin still sees that a link exists.
    return {
      success: true,
      data: { state: "invited", email: profile.email, invitedAt: null },
    }
  }

  const user = userData.user
  if (user.last_sign_in_at) {
    return {
      success: true,
      data: {
        state: "active",
        email: profile.email,
        lastSignInAt: user.last_sign_in_at,
      },
    }
  }

  return {
    success: true,
    data: {
      state: "invited",
      email: profile.email,
      invitedAt: user.invited_at ?? user.created_at ?? null,
    },
  }
}

/**
 * Invites a driver to the self-service area by e-mail. Admin-only.
 *
 * SECURITY CORE (SEC-001): `handle_new_user()` hardcodes every new profile to
 * role='operator'. This flow MUST therefore explicitly correct the freshly
 * created profile to role='driver' AND driver_id=<driverId> in a single update
 * (the `profile_driver_link_check` constraint requires both together). If that
 * correction fails we roll the auth user back via `deleteUser`, so we never
 * leave behind an orphaned account with operator privileges.
 */
export async function inviteDriver(
  driverId: string,
  email: string
): Promise<ActionResult<{ status: DriverInviteStatus }>> {
  const idCheck = uuidSchema.safeParse(driverId)
  if (!idCheck.success) {
    return { success: false, error: "Ungültige Fahrer-ID" }
  }

  const emailCheck = forgotPasswordSchema.safeParse({ email })
  if (!emailCheck.success) {
    return { success: false, error: "Ungültige E-Mail-Adresse" }
  }
  const normalizedEmail = emailCheck.data.email

  const auth = await requireAdmin()
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const supabase = await createClient()

  // 1. Driver must exist.
  const { data: driver } = await supabase
    .from("drivers")
    .select("id, first_name, last_name, is_active")
    .eq("id", driverId)
    .maybeSingle()

  if (!driver) {
    return { success: false, error: "Der ausgewählte Fahrer existiert nicht" }
  }
  if (!driver.is_active) {
    return {
      success: false,
      error: "Inaktive Fahrer können nicht eingeladen werden",
    }
  }

  // 2. Idempotency: a profile already linked to this driver means the driver
  //    was invited before — do not create a second account.
  const { data: existingLink } = await supabase
    .from("profiles")
    .select("id")
    .eq("driver_id", driverId)
    .maybeSingle()

  if (existingLink) {
    return {
      success: false,
      error: "Dieser Fahrer wurde bereits eingeladen",
    }
  }

  // 3. The e-mail must not already belong to another account.
  const { data: emailOwner } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle()

  if (emailOwner) {
    return {
      success: false,
      error: "Diese E-Mail-Adresse wird bereits von einem anderen Konto verwendet",
    }
  }

  // Resolve the app URL robustly (mirror of the auth-action guard): strip any
  // trailing slash and fail loudly in production instead of sending unusable
  // localhost invite links.
  const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "")
  if (!rawAppUrl && process.env.NODE_ENV === "production") {
    console.error(
      "Driver invite aborted: NEXT_PUBLIC_APP_URL is not configured in production."
    )
    return {
      success: false,
      error:
        "Der Dienst ist derzeit nicht korrekt konfiguriert. Bitte kontaktieren Sie den Administrator.",
    }
  }
  const appUrl = rawAppUrl || "http://localhost:3000"

  const displayName = `${driver.first_name} ${driver.last_name}`.trim()
  const adminClient = createAdminClient()

  // 4. Create the auth user WITHOUT sending any e-mail yet [SEC review #2].
  //    handle_new_user() defaults the profile to role='operator'; the invite
  //    link must never go out while the account is still operator-privileged.
  //    Order is therefore strictly: create -> correct+verify -> e-mail.
  const { data: created, error: createError } =
    await adminClient.auth.admin.createUser({
      email: normalizedEmail,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    })

  if (createError || !created.user) {
    console.error("Failed to create driver auth user:", createError)
    if (createError?.message?.toLowerCase().includes("already been registered")) {
      return {
        success: false,
        error: "Diese E-Mail-Adresse wird bereits verwendet",
      }
    }
    return {
      success: false,
      error: "Konto konnte nicht angelegt werden.",
    }
  }

  const newUserId = created.user.id

  // 5. SEC-001 correction: promote the operator-defaulted profile to driver and
  //    link it. role + driver_id must be set together (constraint). We verify a
  //    row was actually updated [SEC review #3] and, on any failure, roll the
  //    auth user back and check that the rollback itself succeeded [SEC review #1].
  const { data: updatedRows, error: profileError } = await adminClient
    .from("profiles")
    .update({
      role: "driver",
      driver_id: driverId,
      display_name: displayName,
    })
    .eq("id", newUserId)
    .select("id")

  const correctionOk =
    !profileError && updatedRows != null && updatedRows.length === 1

  if (!correctionOk) {
    console.error(
      "Driver role correction failed, rolling back auth user:",
      profileError ?? `updated ${updatedRows?.length ?? 0} row(s)`
    )
    const { error: rollbackError } =
      await adminClient.auth.admin.deleteUser(newUserId)

    if (rollbackError) {
      // Worst case: an operator-defaulted account survives. Make it LOUD — this
      // requires manual cleanup and must never pass silently.
      console.error(
        `CRITICAL: rollback deleteUser failed for user ${newUserId} (${normalizedEmail}). ` +
          `An account defaulted to role='operator' may persist and MUST be removed manually.`,
        rollbackError
      )
      return {
        success: false,
        error:
          "Einladung fehlgeschlagen und die automatische Bereinigung schlug fehl. Bitte informieren Sie den Administrator.",
      }
    }

    return {
      success: false,
      error: "Fahrer-Profil konnte nicht verknüpft werden. Einladung abgebrochen.",
    }
  }

  // 6. Only now — role corrected and verified — send the set-password link.
  //    Reuses the same /passwort-setzen target as the reset flow.
  const { error: mailError } = await supabase.auth.resetPasswordForEmail(
    normalizedEmail,
    { redirectTo: `${appUrl}/auth/callback?next=/passwort-setzen` }
  )

  // Fire-and-forget audit log (the account is correctly provisioned as a driver).
  logAudit({
    userId: auth.userId,
    userRole: "admin",
    action: "create",
    entityType: "user",
    entityId: newUserId,
    metadata: { invited_driver_id: driverId, role: "driver", email: normalizedEmail },
  }).catch(() => {})

  revalidatePath("/drivers")

  if (mailError) {
    // The driver account exists and is correctly linked; only the mail failed.
    // Do NOT roll back a valid driver — surface a resend hint instead.
    console.error("Driver invite mail failed to send:", mailError)
    return {
      success: false,
      error:
        "Konto wurde angelegt, aber die Einladungs-E-Mail konnte nicht gesendet werden. Bitte erneut einladen.",
    }
  }

  return {
    success: true,
    data: {
      status: {
        state: "invited",
        email: normalizedEmail,
        invitedAt: created.user.created_at ?? null,
      },
    },
  }
}
