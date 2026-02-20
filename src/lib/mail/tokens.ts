import crypto from "crypto"
import { createAdminClient } from "@/lib/supabase/admin"

const TOKEN_FORMAT = /^[0-9a-f]{64}$/

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex")
}

export async function createAssignmentToken(
  rideId: string,
  driverId: string
): Promise<string> {
  const supabase = createAdminClient()
  const token = generateToken()
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

  const { error } = await supabase.from("assignment_tokens").insert({
    ride_id: rideId,
    driver_id: driverId,
    token,
    expires_at: expiresAt,
  })

  if (error) {
    throw new Error(`Failed to create assignment token: ${error.message}`)
  }

  return token
}

/**
 * Atomically validate and consume a token in a single UPDATE.
 * This eliminates TOCTOU race conditions: the WHERE clause ensures
 * the token is unused and not expired, and the UPDATE sets used_at
 * in one operation.
 */
export async function consumeToken(
  token: string
): Promise<{ id: string; ride_id: string; driver_id: string } | null> {
  if (!TOKEN_FORMAT.test(token)) return null

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("assignment_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token", token)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("id, ride_id, driver_id")
    .single()

  if (error || !data) return null

  return { id: data.id, ride_id: data.ride_id, driver_id: data.driver_id }
}

export async function invalidateTokensForRide(rideId: string): Promise<void> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from("assignment_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("ride_id", rideId)
    .is("used_at", null)

  if (error) {
    console.error(`Failed to invalidate tokens for ride ${rideId}:`, error.message)
  }
}
