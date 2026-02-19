import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/dashboard/page-header"
import { UsersTable } from "@/components/users/users-table"

export const metadata: Metadata = {
  title: "Benutzer - Fahrdienst",
}

export default async function UsersPage() {
  const supabase = await createClient()
  const { data: users } = await supabase
    .from("profiles")
    .select("*")
    .order("display_name")

  return (
    <div className="space-y-6">
      <PageHeader
        title="Benutzer"
        description="Verwalten Sie Ihre Benutzer."
        createHref="/users/new"
        createLabel="Neuer Benutzer"
      />
      <UsersTable users={users ?? []} />
    </div>
  )
}
