import "server-only"

import { MapsApiError } from "./errors"

const MAX_RETRIES = 2
const RETRY_DELAY_MS = 500

/** Google Maps API status codes that are safe to retry */
const RETRYABLE_STATUSES = new Set(["OVER_QUERY_LIMIT", "UNKNOWN_ERROR"])

/** Google Maps API status codes that must NOT be retried */
const NON_RETRYABLE_STATUSES = new Set([
  "INVALID_REQUEST",
  "ZERO_RESULTS",
  "REQUEST_DENIED",
  "NOT_FOUND",
])

/**
 * Returns the API key for Google Maps *Web Service* calls (Geocoding,
 * Directions, Places Web Service).
 *
 * These are server-to-server requests that send no HTTP `Referer` header, so a
 * referer-restricted key (as used by the browser Maps JS / Static Maps API)
 * is rejected by Google with "API keys with referer restrictions cannot be
 * used with this API". We therefore require a dedicated, non-referer-restricted
 * server key:
 *
 *   1. GOOGLE_MAPS_SERVER_API_KEY  — preferred (unrestricted / IP-restricted)
 *   2. GOOGLE_MAPS_API_KEY         — legacy fallback (deprecated), warns
 *
 * NEXT_PUBLIC_GOOGLE_MAPS_API_KEY must never be used here — it is the
 * referer-restricted browser key.
 */
function getApiKey(): string {
  const serverKey = process.env.GOOGLE_MAPS_SERVER_API_KEY
  if (serverKey) {
    return serverKey
  }

  const legacyKey = process.env.GOOGLE_MAPS_API_KEY
  if (legacyKey) {
    console.warn(
      "[maps] GOOGLE_MAPS_SERVER_API_KEY is not set — falling back to the " +
        "deprecated GOOGLE_MAPS_API_KEY. Configure an unrestricted server key " +
        "to avoid referer-restriction errors on Geocoding/Directions/Places."
    )
    return legacyKey
  }

  throw new MapsApiError(
    "No server Maps API key configured. Set GOOGLE_MAPS_SERVER_API_KEY " +
      "(preferred) or GOOGLE_MAPS_API_KEY."
  )
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof MapsApiError) {
    if (error.status && NON_RETRYABLE_STATUSES.has(error.status)) {
      return false
    }
    if (error.status && RETRYABLE_STATUSES.has(error.status)) {
      return true
    }
  }
  // Network errors (fetch failures) are retryable
  if (error instanceof TypeError) {
    return true
  }
  return false
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Generic Google Maps API response shape.
 * All endpoints return { status: string, ... } with varying result fields.
 */
interface MapsApiResponse {
  status: string
  error_message?: string
}

/**
 * Calls a Google Maps API endpoint with retry logic.
 *
 * - Max 2 retries with exponential backoff for retryable errors
 * - Retryable: OVER_QUERY_LIMIT, UNKNOWN_ERROR, network errors
 * - NOT retryable: INVALID_REQUEST, ZERO_RESULTS, REQUEST_DENIED
 *
 * Returns the parsed JSON response. Throws MapsApiError on non-OK statuses.
 * ZERO_RESULTS is not thrown -- caller must check response.status.
 */
export async function callMapsApi<T extends MapsApiResponse>(
  url: string,
  params: Record<string, string>
): Promise<T> {
  const apiKey = getApiKey()
  const searchParams = new URLSearchParams({ ...params, key: apiKey })
  const fullUrl = `${url}?${searchParams.toString()}`

  let lastError: unknown

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(fullUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        // Ensure no Next.js caching for API calls
        cache: "no-store",
      })

      if (!response.ok) {
        throw new MapsApiError(
          `HTTP ${response.status}: ${response.statusText}`,
          "HTTP_ERROR"
        )
      }

      const data = (await response.json()) as T

      // ZERO_RESULTS is not an error -- let the caller handle it
      if (data.status === "ZERO_RESULTS") {
        return data
      }

      // OK is the success status
      if (data.status === "OK") {
        return data
      }

      // Any other status is an error
      throw new MapsApiError(
        data.error_message ?? `Maps API returned status: ${data.status}`,
        data.status
      )
    } catch (error) {
      lastError = error
      if (isRetryableError(error) && attempt < MAX_RETRIES) {
        await delay(RETRY_DELAY_MS * (attempt + 1))
        continue
      }
      // Non-retryable or last attempt -- throw
      if (error instanceof MapsApiError) {
        throw error
      }
      throw new MapsApiError(
        error instanceof Error ? error.message : "Unknown Maps API error"
      )
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError instanceof MapsApiError
    ? lastError
    : new MapsApiError("Max retries exceeded")
}
