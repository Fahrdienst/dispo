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

interface RateLimitResult {
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
