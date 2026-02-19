import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PatientForm } from "@/components/patients/patient-form"

export const metadata: Metadata = {
  title: "Patient bearbeiten - Dispo",
}

interface EditPatientPageProps {
  params: Promise<{ id: string }>
}

export default async function EditPatientPage({
  params,
}: EditPatientPageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: patient } = await supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .single()

  if (!patient) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PatientForm patient={patient} />
    </div>
  )
}
