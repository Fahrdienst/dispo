import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DriverForm } from "@/components/drivers/driver-form"

export const metadata: Metadata = {
  title: "Fahrer bearbeiten - Dispo",
}

interface EditDriverPageProps {
  params: Promise<{ id: string }>
}

export default async function EditDriverPage({ params }: EditDriverPageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: driver } = await supabase
    .from("drivers")
    .select("*")
    .eq("id", id)
    .single()

  if (!driver) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-2xl">
      <DriverForm driver={driver} />
    </div>
  )
}
