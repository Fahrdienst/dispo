import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/dashboard/page-header"
import { RideSeriesTable } from "@/components/ride-series/ride-series-table"

export const metadata: Metadata = {
  title: "Fahrtserien - Dispo",
}

export default async function RideSeriesPage() {
  const supabase = await createClient()

  const { data: seriesList } = await supabase
    .from("ride_series")
    .select(
      "*, patients(id, first_name, last_name), destinations(id, display_name)"
    )
    .order("created_at", { ascending: false })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fahrtserien"
        description="Verwalten Sie wiederkehrende Fahrten."
        createHref="/ride-series/new"
        createLabel="Neue Fahrtserie"
      />

      <RideSeriesTable seriesList={seriesList ?? []} />
    </div>
  )
}
