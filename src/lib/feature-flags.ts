/**
 * Simple server-side feature flags via environment variables.
 * Naming convention: FEATURE_{FLAG_NAME_UPPERCASE}=true|false
 *
 * For multi-instance deployments, replace with LaunchDarkly/Unleash.
 * This module is server-only — never import from client components.
 */

/** All known feature flags in the system. */
type FeatureFlag =
  | "new_dispo_flow"
  | "mfa_required"
  | "acceptance_flow"
  | "pdf_generation"

/**
 * Mapping from FeatureFlag to the actual environment variable key.
 * Kept explicit to avoid accidental exposure via dynamic key construction.
 */
const FLAG_ENV_MAP: Record<FeatureFlag, string> = {
  new_dispo_flow: "FEATURE_NEW_DISPO_FLOW",
  mfa_required: "FEATURE_MFA_REQUIRED",
  acceptance_flow: "ACCEPTANCE_FLOW_ENABLED", // legacy key, already in use
  pdf_generation: "FEATURE_PDF_GENERATION",
} as const

/**
 * Check whether a feature flag is enabled.
 * Reads from process.env at call time (no caching, picks up runtime changes).
 *
 * @param flag - The feature flag to check
 * @returns true if the corresponding env var is exactly "true"
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  const envKey = FLAG_ENV_MAP[flag]
  return process.env[envKey] === "true"
}

/**
 * Return all flags with their current status.
 * Useful for admin dashboards and debugging.
 */
export function getAllFeatureFlags(): Record<FeatureFlag, boolean> {
  const flags = Object.keys(FLAG_ENV_MAP) as FeatureFlag[]
  const result = {} as Record<FeatureFlag, boolean>
  for (const flag of flags) {
    result[flag] = isFeatureEnabled(flag)
  }
  return result
}
