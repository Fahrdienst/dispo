/**
 * Ride requirements -> vehicle type mapping (Issue #126).
 *
 * Pure, UI-independent logic that answers a single question:
 * "Given the transport requirements captured on a ride, which vehicle_type does
 * it need?"
 *
 * Scope decisions (#126):
 *  - The `ride_requirement` set is a superset of `impairment_type`
 *    (rollator/wheelchair/stretcher/companion) plus `oxygen` and `carry_chair`.
 *  - `vehicle_type` is NOT extended in M13. Only `wheelchair` maps to a
 *    dedicated vehicle type; every other requirement -- including `oxygen`,
 *    `carry_chair`, `rollator`, `companion` and `stretcher` -- is treated as an
 *    informative flag and does NOT influence the vehicle type. It therefore
 *    resolves to `standard`.
 *  - `stretcher` deliberately maps to `standard` here even though a `stretcher`
 *    vehicle_type value exists: dedicated stretcher-vehicle selection is out of
 *    scope for M13 and the mapping spec is explicitly "wheelchair -> wheelchair,
 *    otherwise standard".
 *
 * This module has no DB/React/Next dependencies so it can be unit-tested in
 * isolation, mirroring the style of `src/lib/availability/resolve.ts`.
 *
 * Type note: the generated Supabase types do not know the `ride_requirement`
 * enum yet (they are regenerated centrally after the M13 merge). Until then this
 * module owns the canonical `RideRequirement` union; it MUST stay in sync with
 * the enum defined in `supabase/migrations/20260328_000001_ride_requirements.sql`.
 * `VehicleType` is taken from the generated types, which already know it.
 */

import type { Enums } from "@/lib/types/database"

/**
 * The set of transport requirements a ride can carry. Kept in lockstep with the
 * `public.ride_requirement` Postgres enum. Once the generated types include the
 * enum, this can be replaced by `Enums<"ride_requirement">`.
 */
export type RideRequirement =
  | "wheelchair"
  | "rollator"
  | "companion"
  | "oxygen"
  | "carry_chair"
  | "stretcher"

/** Vehicle type as defined by the DB enum (not extended in M13). */
export type VehicleType = Enums<"vehicle_type">

/** Ordered list of all requirement values, useful for UI/iteration (#135). */
export const RIDE_REQUIREMENTS: readonly RideRequirement[] = [
  "wheelchair",
  "rollator",
  "companion",
  "oxygen",
  "carry_chair",
  "stretcher",
] as const

/**
 * Derive the required `vehicle_type` from a set of ride requirements.
 *
 * Mapping (M13): a `wheelchair` requirement needs a `wheelchair` vehicle; every
 * other requirement is informative only and resolves to `standard`. The input
 * order and duplicates do not matter.
 *
 * @param requirements The ride's requirements (may be empty).
 * @returns `"wheelchair"` if wheelchair transport is required, else `"standard"`.
 */
export function requirementsToVehicleType(
  requirements: readonly RideRequirement[]
): VehicleType {
  return requirements.includes("wheelchair") ? "wheelchair" : "standard"
}
