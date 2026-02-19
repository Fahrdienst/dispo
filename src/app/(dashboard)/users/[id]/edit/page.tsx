import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { UserForm } from "@/components/users/user-form"

export const metadata: Metadata = {
  title: "Benutzer bearbeiten - Fahrdienst",
}

interface EditUserPageProps {
  params: Promise<{ id: string }>
}

export default async function EditUserPage({ params }: EditUserPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: user } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single()

  if (!user) {
    notFound()
  }

  // Fetch active drivers not linked to other profiles
  const { data: allDrivers } = await supabase
    .from("drivers")
    .select("id, first_name, last_name, is_active")
    .order("last_name")

  const { data: linkedProfiles } = await supabase
    .from("profiles")
    .select("driver_id")
    .not("driver_id", "is", null)
    .neq("id", id)

  const linkedDriverIds = new Set(
    (linkedProfiles ?? []).map((p) => p.driver_id)
  )

  // Include current user's linked driver even if inactive, plus all active unlinked drivers
  const availableDrivers = (allDrivers ?? []).filter(
    (d) => d.id === user.driver_id || (d.is_active && !linkedDriverIds.has(d.id))
  )

  return (
    <div className="mx-auto max-w-2xl">
      <UserForm user={user} drivers={availableDrivers} />
    </div>
  )
}
