import type { Metadata } from "next"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/dashboard/page-header"
import { RidesTable } from "@/components/rides/rides-table"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Fahrten - Dispo",
}

function formatDateDE(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00")
  return date.toLocaleDateString("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + "T00:00:00")
  date.setDate(date.getDate() + days)
  return date.toISOString().split("T")[0]!
}

function getToday(): string {
  return new Date().toISOString().split("T")[0]!
}

interface RidesPageProps {
  searchParams: Promise<{ date?: string }>
}

export default async function RidesPage({ searchParams }: RidesPageProps) {
  const { date } = await searchParams
  const today = getToday()
  const selectedDate = date ?? today

  const prevDate = addDays(selectedDate, -1)
  const nextDate = addDays(selectedDate, 1)

  const supabase = await createClient()
  const { data: rides } = await supabase
    .from("rides")
    .select(
      "*, patients(id, first_name, last_name), destinations(id, name), drivers(id, first_name, last_name)"
    )
    .eq("date", selectedDate)
    .order("pickup_time")

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fahrten"
        description="Verwalten Sie Ihre Fahrten."
        createHref={`/rides/new?date=${selectedDate}`}
        createLabel="Neue Fahrt"
      />

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/rides?date=${prevDate}`}>
            &larr; Vorheriger Tag
          </Link>
        </Button>
        <span className="px-3 text-sm font-medium">
          {formatDateDE(selectedDate)}
        </span>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/rides?date=${nextDate}`}>
            Nächster Tag &rarr;
          </Link>
        </Button>
        {selectedDate !== today && (
          <Button variant="outline" size="sm" asChild>
            <Link href="/rides">Heute</Link>
          </Button>
        )}
      </div>

      <RidesTable rides={rides ?? []} />
    </div>
  )
}
