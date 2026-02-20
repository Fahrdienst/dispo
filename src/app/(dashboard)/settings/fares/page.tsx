import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/dashboard/page-header"
import { SettingsNav } from "@/components/settings/settings-nav"
import { FareVersionsTable } from "@/components/fares/fare-versions-table"

export const metadata: Metadata = {
  title: "Tarife - Dispo",
}

export default async function FaresPage() {
  const supabase = await createClient()
  const { data: fareVersions } = await supabase
    .from("fare_versions")
    .select("*, fare_rules(count)")
    .order("valid_from", { ascending: false })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tarifversionen"
        description="Verwalten Sie versionierte Tarife fuer die Fahrtenabrechnung."
        createHref="/settings/fares/new"
        createLabel="Neue Tarifversion"
      />
      <SettingsNav />
      <FareVersionsTable fareVersions={fareVersions ?? []} />
    </div>
  )
}
