import { createClient } from "@/lib/supabase/server"

type AdminCheckResult =
  | { authorized: true; userId: string }
  | { authorized: false; error: string }

/**
 * Authorization guard that verifies the current user is an active admin.
 * Uses the normal server client (anon key + RLS) — role is checked from DB,
 * never from JWT claims.
 */
export async function requireAdmin(): Promise<AdminCheckResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { authorized: false, error: "Nicht authentifiziert" }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single()

  if (!profile) {
    return { authorized: false, error: "Profil nicht gefunden" }
  }

  if (!profile.is_active) {
    return { authorized: false, error: "Konto deaktiviert" }
  }

  if (profile.role !== "admin") {
    return { authorized: false, error: "Keine Berechtigung" }
  }

  return { authorized: true, userId: user.id }
}
