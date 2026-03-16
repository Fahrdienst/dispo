import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { RideForm } from "@/components/rides/ride-form"
import { Breadcrumb } from "@/components/shared/breadcrumb"

export const metadata: Metadata = {
  title: "Neue Fahrt - Dispo",
}

interface NewRidePageProps {
  searchParams: Promise<{
    date?: string
    patient_id?: string
    destination_id?: string
  }>
}

export default async function NewRidePage({ searchParams }: NewRidePageProps) {
  const { date, patient_id, destination_id } = await searchParams
  const supabase = await createClient()

  const [patientsRes, destinationsRes, driversRes] = await Promise.all([
    supabase
      .from("patients")
      .select("id, first_name, last_name")
      .eq("is_active", true)
      .order("last_name"),
    supabase
      .from("destinations")
      .select("id, display_name")
      .eq("is_active", true)
      .order("display_name"),
    supabase
      .from("drivers")
      .select("id, first_name, last_name")
      .eq("is_active", true)
      .order("last_name"),
  ])

  return (
    <div className="mx-auto max-w-5xl">
      <Breadcrumb
        items={[
          { label: "Fahrten", href: "/rides" },
          { label: "Neue Fahrt" },
        ]}
      />
      <RideForm
        defaultDate={date}
        defaultPatientId={patient_id}
        defaultDestinationId={destination_id}
        patients={patientsRes.data ?? []}
        destinations={destinationsRes.data ?? []}
        drivers={driversRes.data ?? []}
      />
    </div>
  )
}
