/**
 * Contextual help mapping.
 *
 * Pure, side-effect-free resolution from a Next.js pathname to a help context.
 * Kept free of React / browser dependencies so it can be unit-tested in isolation
 * and reused on both server and client.
 *
 * IMPORTANT: The array order is the matching priority — the FIRST matching
 * pattern wins. More specific routes MUST be listed before more generic ones
 * (e.g. `/rides/new` before `/rides/[id]`).
 */

export type HelpContext = {
  /** Slug used to build the help target route: `/help/{helpSlug}`. */
  helpSlug: string
  /** Human-readable German label shown in the tooltip / for screen readers. */
  label: string
}

type HelpContextRule = {
  pattern: RegExp
  context: HelpContext
}

/** Fallback used when no specific rule matches. */
export const FALLBACK_HELP_CONTEXT: HelpContext = {
  helpSlug: "app-uebersicht",
  label: "Hilfe zu dieser Seite",
}

/**
 * Ordered list of pathname -> help context rules.
 * Specific routes are listed before generic ones so the first match wins.
 */
const HELP_CONTEXT_MAP: HelpContextRule[] = [
  {
    // Dispatch board
    pattern: /^\/dispatch(\/|$)/,
    context: { helpSlug: "dispatch-board", label: "Hilfe zum Dispositions-Board" },
  },
  {
    // New ride form — MUST come before the generic `/rides/[id]` rule.
    pattern: /^\/rides\/new(\/|$)/,
    context: { helpSlug: "fahrt-erfassen", label: "Hilfe zum Erfassen einer Fahrt" },
  },
  {
    // Ride detail (`/rides/[id]`) — any single segment after `/rides/`.
    pattern: /^\/rides\/[^/]+(\/|$)/,
    context: { helpSlug: "fahrt-details", label: "Hilfe zu den Fahrtdetails" },
  },
  {
    // Patient list / creation
    pattern: /^\/patients(\/|$)/,
    context: { helpSlug: "patient-anlegen", label: "Hilfe zum Anlegen von Patienten" },
  },
  {
    // Driver availability (`/drivers/[id]/availability`)
    pattern: /^\/drivers\/[^/]+\/availability(\/|$)/,
    context: { helpSlug: "verfuegbarkeit", label: "Hilfe zur Verfügbarkeit" },
  },
  {
    // Fares / billing settings
    pattern: /^\/settings\/fares(\/|$)/,
    context: { helpSlug: "abrechnung", label: "Hilfe zur Abrechnung" },
  },
  {
    // Driver's own rides
    pattern: /^\/my\/rides(\/|$)/,
    context: { helpSlug: "fahrer-fahrten", label: "Hilfe zu meinen Fahrten" },
  },
]

/**
 * Resolves a pathname to its help context.
 *
 * Query strings and hashes are not expected (Next.js `usePathname()` returns the
 * path only), but a defensive strip is applied for robustness. Returns the
 * fallback context when no rule matches.
 */
export function resolveHelpContext(pathname: string): HelpContext {
  // Defensive normalization: strip query/hash and ensure a leading slash.
  const cleaned = pathname.split(/[?#]/)[0] ?? ""
  const normalized = cleaned.startsWith("/") ? cleaned : `/${cleaned}`

  for (const rule of HELP_CONTEXT_MAP) {
    if (rule.pattern.test(normalized)) {
      return rule.context
    }
  }

  return FALLBACK_HELP_CONTEXT
}
