/**
 * Simple in-memory rate limiter using Map.
 *
 * Limitations:
 * - State is per-process; Vercel Serverless functions do NOT share memory
 *   across cold starts. This is acceptable for single-instance or low-traffic
 *   deployments where most requests hit the same warm instance.
 *
 * For multi-instance deployments, replace with @upstash/ratelimit + Redis.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Cleanup expired entries every 60 seconds to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key)
  }
}, 60_000).unref?.()

interface RateLimitConfig {
  /** Maximum number of requests allowed within the window */
  maxRequests: number
  /** Time window in milliseconds */
  windowMs: number
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  success: boolean
  /** Remaining requests in the current window */
  remaining: number
  /** Unix timestamp (ms) when the window resets */
  resetAt: number
}

/**
 * Check and increment the rate limit counter for a given key.
 *
 * @param key - Unique identifier (e.g. email, IP, userId)
 * @param config - Rate limit configuration
 * @returns Result indicating whether the request is allowed
 */
export function rateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now()
  const entry = store.get(key)

  // No existing entry or window expired – start fresh
  if (!entry || entry.resetAt < now) {
    const resetAt = now + config.windowMs
    store.set(key, { count: 1, resetAt })
    return { success: true, remaining: config.maxRequests - 1, resetAt }
  }

  // Window still active but limit reached
  if (entry.count >= config.maxRequests) {
    return { success: false, remaining: 0, resetAt: entry.resetAt }
  }

  // Window still active, increment counter
  entry.count++
  return {
    success: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  }
}

// ---------------------------------------------------------------------------
// Pre-configured limiters for common use cases
// ---------------------------------------------------------------------------

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000
const ONE_MINUTE_MS = 60 * 1000

/** Rate limit for login attempts: 5 per 15 minutes, keyed by email */
export function rateLimitLogin(email: string): RateLimitResult {
  return rateLimit(`login:${email.toLowerCase().trim()}`, {
    maxRequests: 5,
    windowMs: FIFTEEN_MINUTES_MS,
  })
}

/** Rate limit for ride responses: 10 per minute, keyed by IP */
export function rateLimitRideRespond(ip: string): RateLimitResult {
  return rateLimit(`ride-respond:${ip}`, {
    maxRequests: 10,
    windowMs: ONE_MINUTE_MS,
  })
}

/** Rate limit for billing export: 10 per minute, keyed by userId */
export function rateLimitBillingExport(userId: string): RateLimitResult {
  return rateLimit(`billing-export:${userId}`, {
    maxRequests: 10,
    windowMs: ONE_MINUTE_MS,
  })
}

// ---------------------------------------------------------------------------
// Distributed rate limiting via Upstash Redis (with in-memory fallback)
// ---------------------------------------------------------------------------

const ONE_HOUR_MS = 60 * 60 * 1000
const FEEDBACK_MAX_REQUESTS = 5

/** Shape of a single command result in an Upstash REST pipeline response. */
interface UpstashPipelineEntry {
  result?: number
  error?: string
}

/**
 * Rate limit for in-app feedback: 5 submissions per hour, keyed by userId.
 *
 * Uses a distributed fixed-window counter in Upstash Redis via the REST API
 * (native `fetch`, no extra npm dependency). Falls back to the in-memory
 * limiter when Upstash env vars are missing or the request fails, so a
 * misconfigured or unreachable Redis never blocks feedback entirely.
 */
export async function rateLimitFeedback(
  userId: string
): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  const key = `feedback:${userId}`

  const fallback = (): RateLimitResult =>
    rateLimit(key, {
      maxRequests: FEEDBACK_MAX_REQUESTS,
      windowMs: ONE_HOUR_MS,
    })

  // No Upstash configured — use the in-memory limiter.
  if (!url || !token) {
    return fallback()
  }

  const windowSeconds = ONE_HOUR_MS / 1000

  try {
    // Pipeline: INCR the counter, then set the TTL only on first hit (EXPIRE NX)
    // so the window is anchored to the first request in it.
    const response = await fetch(`${url.replace(/\/+$/, "")}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, windowSeconds, "NX"],
      ]),
    })

    if (!response.ok) {
      console.error(
        `[rate-limit] Upstash responded HTTP ${response.status}; falling back`
      )
      return fallback()
    }

    const data = (await response.json()) as UpstashPipelineEntry[]
    const count = data[0]?.result

    if (typeof count !== "number") {
      console.error("[rate-limit] Unexpected Upstash response; falling back")
      return fallback()
    }

    const resetAt = Date.now() + ONE_HOUR_MS
    if (count > FEEDBACK_MAX_REQUESTS) {
      return { success: false, remaining: 0, resetAt }
    }

    return {
      success: true,
      remaining: Math.max(0, FEEDBACK_MAX_REQUESTS - count),
      resetAt,
    }
  } catch (error) {
    console.error("[rate-limit] Upstash request failed; falling back:", error)
    return fallback()
  }
}
