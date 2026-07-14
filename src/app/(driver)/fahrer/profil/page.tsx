import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Info } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/require-auth"
import { ProfileForm } from "@/components/driver/profile-form"
import { VEHICLE_TYPE_LABELS } from "@/lib/rides/constants"

export const metadata: Metadata = {
  title: "Profil - Fahrdienst",
}

export default async function DriverProfilePage(): Promise<React.ReactElement> {
  const auth = await requireAuth(["driver"])
  if (!auth.authorized || !auth.driverId) {
    redirect("/")
  }

  const supabase = await createClient()
  const { data: driver } = await supabase
    .from("drivers")
    .select(
      "first_name, last_name, vehicle_type, phone, email, street, house_number, postal_code, city"
    )
    .eq("id", auth.driverId)
    .single()

  if (!driver) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Profil
        </h1>
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-muted-foreground">
          Profil konnte nicht geladen werden. Bitte melden Sie sich erneut an.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Profil
        </h1>
        <p className="text-sm text-muted-foreground">Ihre Kontaktdaten</p>
      </div>

      {/* Read-only identity block */}
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Name
          </p>
          <p className="text-base font-medium text-slate-900">
            {driver.first_name} {driver.last_name}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Fahrzeugtyp
          </p>
          <p className="text-base font-medium text-slate-900">
            {VEHICLE_TYPE_LABELS[driver.vehicle_type]}
          </p>
        </div>
        <p className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Diese Angaben ändert die Disposition.
        </p>
      </div>

      <ProfileForm
        defaultValues={{
          phone: driver.phone,
          email: driver.email,
          street: driver.street,
          house_number: driver.house_number,
          postal_code: driver.postal_code,
          city: driver.city,
        }}
      />
    </div>
  )
}
