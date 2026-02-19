import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/types/database"

/**
 * Creates a Supabase admin client with the Service Role Key.
 * This bypasses RLS and should only be used for admin operations
 * like creating/deleting auth users.
 *
 * Server-only — never import this in client code.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL environment variable"
    )
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
