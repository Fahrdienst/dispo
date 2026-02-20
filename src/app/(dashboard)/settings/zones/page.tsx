import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/dashboard/page-header"
import { ZonesTable } from "@/components/zones/zones-table"

export const metadata: Metadata = {
  title: "Zonen - Dispo",
}

export default async function ZonesPage() {
  const supabase = await createClient()
  const { data: zones } = await supabase
    .from("zones")
    .select("*, zone_postal_codes(*)")
    .order("name")

  return (
    <div className="space-y-6">
      <PageHeader
        title="Zonen"
        description="Verwalten Sie geografische Zonen fuer die Tarifberechnung."
        createHref="/settings/zones/new"
        createLabel="Neue Zone"
      />
      <ZonesTable zones={zones ?? []} />
    </div>
  )
}
