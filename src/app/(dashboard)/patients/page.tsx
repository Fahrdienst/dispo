import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/dashboard/page-header"
import { PatientsTable } from "@/components/patients/patients-table"
import type { Enums } from "@/lib/types/database"

export const metadata: Metadata = {
  title: "Patienten - Dispo",
}

export default async function PatientsPage() {
  const supabase = await createClient()

  const [{ data: patients }, { data: profile }] = await Promise.all([
    supabase
      .from("patients")
      .select("*, patient_impairments(*)")
      .order("last_name"),
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
        title="Patienten"
        description="Verwalten Sie Ihre Patienten."
        createHref="/patients/new"
        createLabel="Neuer Patient"
      />
      <PatientsTable patients={patients ?? []} userRole={userRole} />
    </div>
  )
}
