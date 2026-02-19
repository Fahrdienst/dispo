import { createClient } from "@/lib/supabase/server"
import type { Enums } from "@/lib/types/database"

type UserRole = Enums<"user_role">

type AuthResult =
  | { authorized: true; userId: string; role: UserRole; driverId: string | null }
  | { authorized: false; error: string }

/**
 * Authorization guard that verifies the current user is authenticated and active.
 * Returns the user's role and linked driver_id (if any).
 *
 * Optionally restricts to specific roles via the `roles` parameter.
 */
export async function requireAuth(
  roles?: readonly UserRole[]
): Promise<AuthResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { authorized: false, error: "Nicht authentifiziert" }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active, driver_id")
    .eq("id", user.id)
    .single()

  if (!profile) {
    return { authorized: false, error: "Profil nicht gefunden" }
  }

  if (!profile.is_active) {
    return { authorized: false, error: "Konto deaktiviert" }
  }

  if (roles && !roles.includes(profile.role)) {
    return { authorized: false, error: "Keine Berechtigung" }
  }

  return {
    authorized: true,
    userId: user.id,
    role: profile.role,
    driverId: profile.driver_id,
  }
}
