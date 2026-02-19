import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DestinationForm } from "@/components/destinations/destination-form"

export const metadata: Metadata = {
  title: "Ziel bearbeiten - Dispo",
}

interface EditDestinationPageProps {
  params: Promise<{ id: string }>
}

export default async function EditDestinationPage({
  params,
}: EditDestinationPageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: destination } = await supabase
    .from("destinations")
    .select("*")
    .eq("id", id)
    .single()

  if (!destination) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-2xl">
      <DestinationForm destination={destination} />
    </div>
  )
}
