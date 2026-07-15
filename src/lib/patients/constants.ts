import type { Tables } from "@/lib/types/database"

/**
 * Cost bearer (Kostenträger) options for a patient — Issue #125.
 *
 * The generated DB types (`src/lib/types/database.ts`) do NOT yet include the
 * `cost_bearer` column or the `cost_bearer_type` enum; they are regenerated
 * centrally after the M13 merge. Until then, this module is the single source of
 * truth for the enum values, their German labels and a locally-extended patient
 * type, so app code can read/write the column with an explicit, documented cast
 * instead of `any`. Once the types are regenerated, prefer `Enums<"cost_bearer_type">`.
 */
export const COST_BEARER_VALUES = [
  "health_insurance",
  "self_payer",
  "municipality",
  "other",
] as const

export type CostBearer = (typeof COST_BEARER_VALUES)[number]

export const COST_BEARER_LABELS: Record<CostBearer, string> = {
  health_insurance: "Krankenkasse",
  self_payer: "Selbstzahler",
  municipality: "Gemeinde",
  other: "Sonstiges",
}

/** Sentinel <Select> value meaning "no cost bearer chosen" — maps to NULL. */
export const COST_BEARER_NONE = "__none__"

/**
 * Patient row extended with the not-yet-generated `cost_bearer` column.
 * Use for READS until the DB types are regenerated (#125).
 */
export type PatientWithCostBearer = Tables<"patients"> & {
  cost_bearer: CostBearer | null
}
