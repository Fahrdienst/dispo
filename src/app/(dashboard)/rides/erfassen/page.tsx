import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/require-auth"
import { PageHeader } from "@/components/dashboard/page-header"
import { RideCaptureForm } from "@/components/rides/ride-capture-form"
import { loadRideTimeBuffers } from "@/lib/rides/time-buffers"
import type {
  CapturePatient,
  CaptureDestination,
} from "@/components/rides/capture/types"

export const metadata: Metadata = {
  title: "Fahrt erfassen - Dispo",
}

interface ErfassenPageProps {
  searchParams: Promise<{
    date?: string
    patient_id?: string
    destination_id?: string
  }>
}

export default async function ErfassenPage({ searchParams }: ErfassenPageProps) {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    redirect("/login")
  }

  const { date, patient_id, destination_id } = await searchParams
  const supabase = await createClient()

  const [patientsRes, destinationsRes, timeBuffers] = await Promise.all([
    supabase
      .from("patients")
      .select("id, first_name, last_name, cost_bearer")
      .eq("is_active", true)
      .order("last_name"),
    supabase
      .from("destinations")
      .select("id, display_name, postal_code")
      .eq("is_active", true)
      .order("display_name"),
    loadRideTimeBuffers(supabase),
  ])

  const patients: CapturePatient[] = patientsRes.data ?? []
  const destinations: CaptureDestination[] = destinationsRes.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fahrt erfassen"
        description="Wer → wohin & wann → Fahrt. Ergebnis rechts live."
        backHref="/rides"
        backLabel="Zu den Fahrten"
      />
      <RideCaptureForm
        patients={patients}
        destinations={destinations}
        timeBuffers={timeBuffers}
        defaultDate={date}
        defaultPatientId={patient_id}
        defaultDestinationId={destination_id}
      />
    </div>
  )
}
