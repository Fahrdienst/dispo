import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/dashboard/page-header"
import { AvailabilityGrid } from "@/components/drivers/availability-grid"

export const metadata: Metadata = {
  title: "Verfuegbarkeit - Dispo",
}

interface AvailabilityPageProps {
  params: Promise<{ id: string }>
}

export default async function AvailabilityPage({ params }: AvailabilityPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: driver } = await supabase
    .from("drivers")
    .select("id, first_name, last_name")
    .eq("id", id)
    .single()

  if (!driver) {
    notFound()
  }

  const { data: slots } = await supabase
    .from("driver_availability")
    .select("day_of_week, start_time")
    .eq("driver_id", id)
    .not("day_of_week", "is", null)

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Verfuegbarkeit: ${driver.first_name} ${driver.last_name}`}
        description="Woechentliches Verfuegbarkeitsraster (Mo-Fr, 08:00-18:00)"
        backHref={`/drivers/${id}/edit`}
        backLabel="Zurueck zum Fahrer"
      />
      <AvailabilityGrid
        driverId={id}
        initialSlots={
          (slots ?? [])
            .filter((s) => s.day_of_week !== null)
            .map((s) => ({
              day_of_week: s.day_of_week as string,
              start_time: s.start_time.slice(0, 5),
            }))
        }
      />
    </div>
  )
}
