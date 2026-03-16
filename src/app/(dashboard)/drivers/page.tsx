import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/dashboard/page-header"
import { DriversTable } from "@/components/drivers/drivers-table"
import type { Enums } from "@/lib/types/database"

export const metadata: Metadata = {
  title: "Fahrer - Dispo",
}

export default async function DriversPage() {
  const supabase = await createClient()

  const [{ data: drivers }, { data: profile }] = await Promise.all([
    supabase.from("drivers").select("*").order("last_name"),
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return { data: null }
      return supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()
    }),
  ])

  const userRole = (profile?.role ?? "operator") as Enums<"user_role">

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fahrer"
        description="Verwalten Sie Ihre Fahrer."
        createHref="/drivers/new"
        createLabel="Neuer Fahrer"
      />
      <DriversTable drivers={drivers ?? []} userRole={userRole} />
    </div>
  )
}
