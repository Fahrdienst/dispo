import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { RideSeriesForm } from "@/components/ride-series/ride-series-form"

export const metadata: Metadata = {
  title: "Neue Fahrtserie - Dispo",
}

export default async function NewRideSeriesPage() {
  const supabase = await createClient()

  const [patientsRes, destinationsRes] = await Promise.all([
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
  ])

  return (
    <div className="mx-auto max-w-2xl">
      <RideSeriesForm
        patients={patientsRes.data ?? []}
        destinations={destinationsRes.data ?? []}
      />
    </div>
  )
}
