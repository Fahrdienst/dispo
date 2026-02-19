import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { UserForm } from "@/components/users/user-form"

export const metadata: Metadata = {
  title: "Neuer Benutzer - Fahrdienst",
}

export default async function NewUserPage() {
  const supabase = await createClient()

  // Fetch active drivers that are not already linked to a profile
  const { data: allDrivers } = await supabase
    .from("drivers")
    .select("id, first_name, last_name, is_active")
    .eq("is_active", true)
    .order("last_name")

  const { data: linkedProfiles } = await supabase
    .from("profiles")
    .select("driver_id")
    .not("driver_id", "is", null)

  const linkedDriverIds = new Set(
    (linkedProfiles ?? []).map((p) => p.driver_id)
  )

  const availableDrivers = (allDrivers ?? []).filter(
    (d) => !linkedDriverIds.has(d.id)
  )

  return (
    <div className="mx-auto max-w-2xl">
      <UserForm drivers={availableDrivers} />
    </div>
  )
}
