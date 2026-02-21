import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { RideForm } from "@/components/rides/ride-form"

export const metadata: Metadata = {
  title: "Neue Fahrt - Dispo",
}

interface NewRidePageProps {
  searchParams: Promise<{ date?: string }>
}

export default async function NewRidePage({ searchParams }: NewRidePageProps) {
  const { date } = await searchParams
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
      <RideForm
        defaultDate={date}
        patients={patientsRes.data ?? []}
        destinations={destinationsRes.data ?? []}
        drivers={driversRes.data ?? []}
      />
    </div>
  )
}
