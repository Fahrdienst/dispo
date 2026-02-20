import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/require-auth"
import { PageHeader } from "@/components/dashboard/page-header"
import { AvailabilityGrid } from "@/components/drivers/availability-grid"

export const metadata: Metadata = {
  title: "Meine Verfuegbarkeit - Dispo",
}

export default async function MyAvailabilityPage() {
  const auth = await requireAuth(["driver"])
  if (!auth.authorized) {
    redirect("/login")
  }

  if (!auth.driverId) {
    redirect("/login")
  }

  const supabase = await createClient()

  const [{ data: driver }, { data: slots }] = await Promise.all([
    supabase
      .from("drivers")
      .select("id, first_name, last_name")
      .eq("id", auth.driverId)
      .single(),
    supabase
      .from("driver_availability")
      .select("day_of_week, start_time")
      .eq("driver_id", auth.driverId)
      .not("day_of_week", "is", null),
  ])

  if (!driver) {
    redirect("/login")
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meine Verfuegbarkeit"
        description="Woechentliches Verfuegbarkeitsraster (Mo-Fr, 08:00-18:00)"
      />
      <AvailabilityGrid
        driverId={driver.id}
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
