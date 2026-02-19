import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/dashboard/page-header"
import { DestinationsTable } from "@/components/destinations/destinations-table"

export const metadata: Metadata = {
  title: "Ziele - Dispo",
}

export default async function DestinationsPage() {
  const supabase = await createClient()
  const { data: destinations } = await supabase
    .from("destinations")
    .select("*")
    .order("name")

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ziele"
        description="Verwalten Sie Ziele und Einrichtungen."
        createHref="/destinations/new"
        createLabel="Neues Ziel"
      />
      <DestinationsTable destinations={destinations ?? []} />
    </div>
  )
}
