import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { RideSeriesForm } from "@/components/ride-series/ride-series-form"

export const metadata: Metadata = {
  title: "Fahrtserie bearbeiten - Dispo",
}

interface EditRideSeriesPageProps {
  params: Promise<{ id: string }>
}

export default async function EditRideSeriesPage({
  params,
}: EditRideSeriesPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const [seriesRes, patientsRes, destinationsRes] = await Promise.all([
    supabase.from("ride_series").select("*").eq("id", id).single(),
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

  if (!seriesRes.data) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-2xl">
      <RideSeriesForm
        series={seriesRes.data}
        patients={patientsRes.data ?? []}
        destinations={destinationsRes.data ?? []}
      />
    </div>
  )
}
