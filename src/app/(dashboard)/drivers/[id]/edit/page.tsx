import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CalendarDays } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { DriverForm } from "@/components/drivers/driver-form"
import { Breadcrumb } from "@/components/shared/breadcrumb"
import { Button } from "@/components/ui/button"

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
      <Breadcrumb
        items={[
          { label: "Fahrer", href: "/drivers" },
          { label: "Bearbeiten" },
        ]}
      />
      <div className="mb-4 flex justify-end">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/rides?driver_id=${id}`}>
            <CalendarDays className="mr-2 h-4 w-4" />
            Fahrten anzeigen
          </Link>
        </Button>
      </div>
      <DriverForm driver={driver} />
    </div>
  )
}
