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

  const [rideRes, patientsRes, destinationsRes, driversRes, childRidesRes] =
    await Promise.all([
      supabase.from("rides").select("*").eq("id", id).single(),
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
      // Count child rides (return rides linked to this ride)
      supabase
        .from("rides")
        .select("id", { count: "exact", head: true })
        .eq("parent_ride_id", id),
    ])

  if (!rideRes.data) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-5xl">
      <RideForm
        ride={rideRes.data}
        patients={patientsRes.data ?? []}
        destinations={destinationsRes.data ?? []}
        drivers={driversRes.data ?? []}
        linkedRideCount={childRidesRes.count ?? 0}
        hasParentRide={!!rideRes.data.parent_ride_id}
      />
    </div>
  )
}
