import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ZoneForm } from "@/components/zones/zone-form"
import { PostalCodesManager } from "@/components/zones/postal-codes-manager"

export const metadata: Metadata = {
  title: "Zone bearbeiten - Dispo",
}

interface EditZonePageProps {
  params: Promise<{ id: string }>
}

export default async function EditZonePage({ params }: EditZonePageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: zone } = await supabase
    .from("zones")
    .select("*")
    .eq("id", id)
    .single()

  if (!zone) {
    notFound()
  }

  const { data: postalCodes } = await supabase
    .from("zone_postal_codes")
    .select("*")
    .eq("zone_id", id)
    .order("postal_code")

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <ZoneForm zone={zone} />
      <PostalCodesManager zoneId={id} postalCodes={postalCodes ?? []} />
    </div>
  )
}
