import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/dashboard/page-header"
import { DriversTable } from "@/components/drivers/drivers-table"

export const metadata: Metadata = {
  title: "Fahrer - Dispo",
}

export default async function DriversPage() {
  const supabase = await createClient()
  const { data: drivers } = await supabase
    .from("drivers")
    .select("*")
    .order("last_name")

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fahrer"
        description="Verwalten Sie Ihre Fahrer."
        createHref="/drivers/new"
        createLabel="Neuer Fahrer"
      />
      <DriversTable drivers={drivers ?? []} />
    </div>
  )
}
