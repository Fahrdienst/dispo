import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { RideForm } from "@/components/rides/ride-form"

export const metadata: Metadata = {
  title: "Fahrt bearbeiten - Dispo",
}

interface EditRidePageProps {
  params: Promise<{ id: string }>
}

export default async function EditRidePage({ params }: EditRidePageProps) {
  const { id } = await params
  const supabase = await createClient()

  const [rideRes, patientsRes, destinationsRes, driversRes] =
    await Promise.all([
      supabase.from("rides").select("*").eq("id", id).single(),
      supabase
        .from("patients")
        .select("id, first_name, last_name")
        .eq("is_active", true)
        .order("last_name"),
      supabase
        .from("destinations")
        .select("id, name")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("drivers")
        .select("id, first_name, last_name")
        .eq("is_active", true)
        .order("last_name"),
    ])

  if (!rideRes.data) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-2xl">
      <RideForm
        ride={rideRes.data}
        patients={patientsRes.data ?? []}
        destinations={destinationsRes.data ?? []}
        drivers={driversRes.data ?? []}
      />
    </div>
  )
}
