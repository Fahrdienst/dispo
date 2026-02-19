import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/dashboard/page-header"
import { PatientsTable } from "@/components/patients/patients-table"

export const metadata: Metadata = {
  title: "Patienten - Dispo",
}

export default async function PatientsPage() {
  const supabase = await createClient()
  const { data: patients } = await supabase
    .from("patients")
    .select("*, patient_impairments(*)")
    .order("last_name")

  return (
    <div className="space-y-6">
      <PageHeader
        title="Patienten"
        description="Verwalten Sie Ihre Patienten."
        createHref="/patients/new"
        createLabel="Neuer Patient"
      />
      <PatientsTable patients={patients ?? []} />
    </div>
  )
}
