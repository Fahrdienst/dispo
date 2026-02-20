import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { FareVersionForm } from "@/components/fares/fare-version-form"
import { FareRulesManager } from "@/components/fares/fare-rules-manager"

export const metadata: Metadata = {
  title: "Tarifversion bearbeiten - Dispo",
}

interface EditFareVersionPageProps {
  params: Promise<{ id: string }>
}

export default async function EditFareVersionPage({
  params,
}: EditFareVersionPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: fareVersion } = await supabase
    .from("fare_versions")
    .select("*")
    .eq("id", id)
    .single()

  if (!fareVersion) {
    notFound()
  }

  // Fetch fare rules with zone names joined
  const { data: rules } = await supabase
    .from("fare_rules")
    .select("*, from_zone:zones!fare_rules_from_zone_id_fkey(*), to_zone:zones!fare_rules_to_zone_id_fkey(*)")
    .eq("fare_version_id", id)
    .order("created_at")

  // Fetch active zones for the rule creation form
  const { data: zones } = await supabase
    .from("zones")
    .select("*")
    .eq("is_active", true)
    .order("name")

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <FareVersionForm fareVersion={fareVersion} />
      <FareRulesManager
        fareVersionId={id}
        rules={(rules ?? []) as Array<import("@/lib/types/database").Tables<"fare_rules"> & { from_zone: import("@/lib/types/database").Tables<"zones">; to_zone: import("@/lib/types/database").Tables<"zones"> }>}
        zones={zones ?? []}
      />
    </div>
  )
}
