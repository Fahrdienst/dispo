import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/require-auth"
import { PageHeader } from "@/components/dashboard/page-header"
import { AvailabilityGrid } from "@/components/drivers/availability-grid"
import { DateSpecificAvailability } from "@/components/drivers/date-specific-availability"

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

  const [{ data: driver }, { data: weeklySlots }, { data: dateSlots }] = await Promise.all([
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
    supabase
      .from("driver_availability")
      .select("specific_date, start_time")
      .eq("driver_id", auth.driverId)
      .not("specific_date", "is", null),
  ])

  if (!driver) {
    redirect("/login")
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meine Verfuegbarkeit"
        description="Woechentliches Verfuegbarkeitsraster und datumsspezifische Einmal-Slots"
      />
      <AvailabilityGrid
        driverId={driver.id}
        initialSlots={
          (weeklySlots ?? [])
            .filter((s) => s.day_of_week !== null)
            .map((s) => ({
              day_of_week: s.day_of_week as string,
              start_time: s.start_time.slice(0, 5),
            }))
        }
      />
      <DateSpecificAvailability
        driverId={driver.id}
        initialSlots={
          (dateSlots ?? [])
            .filter((s) => s.specific_date !== null)
            .map((s) => ({
              specific_date: s.specific_date as string,
              start_time: s.start_time.slice(0, 5),
            }))
        }
      />
    </div>
  )
}
