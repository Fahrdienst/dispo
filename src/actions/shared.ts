/**
 * A non-blocking warning attached to a successful action result.
 *
 * Warnings communicate soft problems (e.g. missing geocoding, price that could
 * not be calculated) that MUST NOT prevent the operation from succeeding. The
 * `code` is a stable, whitelisted machine identifier the UI (#139) can map to
 * localized copy or decide to suppress; `message` is a ready-to-render German
 * fallback.
 */
export interface ActionWarning {
  /** Stable machine code (whitelisted) for the UI to map/suppress (#139). */
  code: string
  /** Human-readable German fallback message. */
  message: string
  /** Optional related form field, mirroring `fieldErrors` keys. */
  field?: string
}

export type ActionResult<T = void> =
  | { success: true; data: T; warnings?: ActionWarning[] }
  | { success: false; error?: string; fieldErrors?: Record<string, string[]> }
