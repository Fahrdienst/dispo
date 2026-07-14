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
 * Type note: `RIDE_REQUIREMENTS` is the canonical, ordered source of truth for
 * the `RideRequirement` union and drives the Zod enum in
 * `src/lib/validations/rides.ts`. It MUST stay in lockstep with the
 * `public.ride_requirement` Postgres enum
 * (`supabase/migrations/20260716_000001_ride_requirements.sql`). The generated
 * Supabase types now know that enum; `_RequirementsMatchEnum` below asserts at
 * compile time that this list and the DB enum are identical.
 * `VehicleType` is taken from the generated types.
 */

import type { Enums } from "@/lib/types/database"

/**
 * Ordered list of all requirement values -- the single source of truth for both
 * the `RideRequirement` union and the runtime Zod whitelist (#126, #135).
 */
export const RIDE_REQUIREMENTS = [
  "wheelchair",
  "rollator",
  "companion",
  "oxygen",
  "carry_chair",
  "stretcher",
] as const

/**
 * The set of transport requirements a ride can carry. Derived from
 * {@link RIDE_REQUIREMENTS} and kept in lockstep with the
 * `public.ride_requirement` Postgres enum.
 */
export type RideRequirement = (typeof RIDE_REQUIREMENTS)[number]

/** Vehicle type as defined by the DB enum (not extended in M13). */
export type VehicleType = Enums<"vehicle_type">

/**
 * Compile-time guarantee that the local list matches the DB enum exactly (both
 * directions). `Assert<T extends true>` fails to typecheck if the condition is
 * `false`, so any divergence between this list and the migration is a build
 * error. Purely a type-level assertion -- no runtime footprint.
 */
type Assert<T extends true> = T
export type _RequirementsMatchEnum = Assert<
  [RideRequirement] extends [Enums<"ride_requirement">]
    ? [Enums<"ride_requirement">] extends [RideRequirement]
      ? true
      : false
    : false
>


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
