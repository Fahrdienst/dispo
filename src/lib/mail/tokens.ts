import crypto from "crypto"
import { createAdminClient } from "@/lib/supabase/admin"

const TOKEN_FORMAT = /^[0-9a-f]{64}$/

/**
 * SHA-256 hash a plaintext token for secure storage (SEC-M9-001).
 * Deterministic: same input always produces same output.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex")
}

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
    token_hash: hashToken(token),
    expires_at: expiresAt,
  })

  if (error) {
    throw new Error(`Failed to create assignment token: ${error.message}`)
  }

  // Return plaintext token for inclusion in email links
  return token
}

/**
 * Atomically validate and consume a token in a single UPDATE.
 * Hashes the input before querying (SEC-M9-001).
 * Stores the action for idempotency (SEC-M9-003).
 */
export async function consumeToken(
  token: string,
  action: string
): Promise<{
  id: string
  ride_id: string
  driver_id: string
  action: string | null
  already_used: boolean
} | null> {
  if (!TOKEN_FORMAT.test(token)) return null

  const supabase = createAdminClient()
  const hashed = hashToken(token)

  // First check if token exists and was already used (idempotency check)
  const { data: existing } = await supabase
    .from("assignment_tokens")
    .select("id, ride_id, driver_id, action, used_at")
    .eq("token_hash", hashed)
    .single()

  if (!existing) return null

  // SEC-M9-003: If already used with same action, return success (idempotent)
  if (existing.used_at && existing.action === action) {
    return {
      id: existing.id,
      ride_id: existing.ride_id,
      driver_id: existing.driver_id,
      action: existing.action,
      already_used: true,
    }
  }

  // If already used with different action, return null (action mismatch)
  if (existing.used_at && existing.action !== action) {
    return null
  }

  // Atomically consume: UPDATE only if still unused and not expired
  const { data, error } = await supabase
    .from("assignment_tokens")
    .update({ used_at: new Date().toISOString(), action })
    .eq("token_hash", hashed)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("id, ride_id, driver_id, action")
    .single()

  if (error || !data) return null

  return {
    id: data.id,
    ride_id: data.ride_id,
    driver_id: data.driver_id,
    action: data.action,
    already_used: false,
  }
}

/**
 * Peek at a token without consuming it (for confirm page preview).
 * Returns token data if valid and unused, null otherwise.
 */
export async function peekToken(
  token: string
): Promise<{ id: string; ride_id: string; driver_id: string } | null> {
  if (!TOKEN_FORMAT.test(token)) return null

  const supabase = createAdminClient()
  const hashed = hashToken(token)

  const { data, error } = await supabase
    .from("assignment_tokens")
    .select("id, ride_id, driver_id")
    .eq("token_hash", hashed)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
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
