import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Info } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/require-auth"
import { WeeklyAvailabilityEditor } from "@/components/driver/weekly-availability-editor"
import { DateExceptionEditor } from "@/components/driver/date-exception-editor"

export const metadata: Metadata = {
  title: "Verfügbarkeit - Fahrdienst",
}

export default async function DriverAvailabilityPage(): Promise<React.ReactElement> {
  const auth = await requireAuth(["driver"])
  if (!auth.authorized || !auth.driverId) {
    redirect("/")
  }

  const driverId = auth.driverId
  const supabase = await createClient()

  const [{ data: weeklyRows }, { data: dateRows }] = await Promise.all([
    supabase
      .from("driver_availability")
      .select("day_of_week, start_time")
      .eq("driver_id", driverId)
      .not("day_of_week", "is", null),
    supabase
      .from("driver_availability")
      .select("specific_date, start_time")
      .eq("driver_id", driverId)
      .not("specific_date", "is", null)
      .gte("specific_date", new Date().toISOString().slice(0, 10)),
  ])

  // Normalize Postgres "HH:MM:SS" to "HH:MM" for the fixed-slot UI.
  const weeklySlots = (weeklyRows ?? [])
    .filter((r) => r.day_of_week !== null)
    .map((r) => ({
      day_of_week: r.day_of_week as string,
      start_time: r.start_time.slice(0, 5),
    }))

  const dateSlots = (dateRows ?? [])
    .filter((r) => r.specific_date !== null)
    .map((r) => ({
      specific_date: r.specific_date as string,
      start_time: r.start_time.slice(0, 5),
    }))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Verfügbarkeit
        </h1>
        <p className="text-sm text-muted-foreground">
          Wann sind Sie regelmäßig für Fahrten einteilbar?
        </p>
      </div>

      <p className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        Tippen Sie die 2-Stunden-Fenster an, in denen Sie verfügbar sind. Ohne
        Eintrag gelten Sie an dem Tag als nicht verfügbar.
      </p>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Wochenraster</h2>
        <WeeklyAvailabilityEditor
          driverId={driverId}
          initialSlots={weeklySlots}
        />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Ausnahmen an einzelnen Tagen
          </h2>
          <p className="text-sm text-muted-foreground">
            Eine Ausnahme ersetzt das Wochenraster für diesen einen Tag.
          </p>
        </div>
        <DateExceptionEditor
          driverId={driverId}
          weeklySlots={weeklySlots}
          initialDateSlots={dateSlots}
        />
      </section>
    </div>
  )
}
