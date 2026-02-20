import { createClient } from "@/lib/supabase/server"
import type { Tables } from "@/lib/types/database"

type Zone = Tables<"zones">
type FareRule = Tables<"fare_rules">

/**
 * Look up which zone a postal code belongs to.
 * Returns the zone or null if the postal code is not assigned to any zone.
 */
export async function getZoneForPostalCode(
  postalCode: string
): Promise<Zone | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("zone_postal_codes")
    .select("zone_id, zones(*)")
    .eq("postal_code", postalCode)
    .single()

  if (error || !data) {
    return null
  }

  // Supabase returns the joined zone as `zones` (table name)
  const zone = data.zones as unknown as Zone | null
  return zone ?? null
}

/**
 * Find the applicable fare rule for a trip between two postal codes on a given date.
 * Looks up zones for both postal codes, then finds the active fare version
 * valid on the given date with a matching from_zone -> to_zone rule.
 *
 * Returns the fare rule with its fare_version joined, or null if no rule applies.
 */
export async function getFareRule(
  fromPostalCode: string,
  toPostalCode: string,
  date: string
): Promise<(FareRule & { fare_versions: Tables<"fare_versions"> }) | null> {
  const fromZone = await getZoneForPostalCode(fromPostalCode)
  const toZone = await getZoneForPostalCode(toPostalCode)

  if (!fromZone || !toZone) {
    return null
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from("fare_rules")
    .select("*, fare_versions!inner(*)")
    .eq("from_zone_id", fromZone.id)
    .eq("to_zone_id", toZone.id)
    .eq("fare_versions.is_active", true)
    .lte("fare_versions.valid_from", date)
    .or(`valid_to.is.null,valid_to.gte.${date}`, {
      referencedTable: "fare_versions",
    })
    .limit(1)
    .single()

  if (error || !data) {
    return null
  }

  return data as FareRule & { fare_versions: Tables<"fare_versions"> }
}
