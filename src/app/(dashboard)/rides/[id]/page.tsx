import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/require-auth"
import { PageHeader } from "@/components/dashboard/page-header"
import { RideStatusBadge } from "@/components/shared/ride-status-badge"
import { CommunicationTimeline } from "@/components/rides/communication-timeline"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RIDE_DIRECTION_LABELS } from "@/lib/rides/constants"

export const metadata: Metadata = {
  title: "Fahrtdetails - Dispo",
}

function formatDateDE(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00")
  return date.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

interface RideDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function RideDetailPage({ params }: RideDetailPageProps) {
  const { id } = await params

  const auth = await requireAuth()
  if (!auth.authorized) {
    notFound()
  }

  const isStaff = auth.role === "admin" || auth.role === "operator"

  const supabase = await createClient()

  // Fetch ride with relations
  const { data: ride } = await supabase
    .from("rides")
    .select(
      "*, patients(id, first_name, last_name, phone), destinations(id, display_name, street, house_number, postal_code, city), drivers(id, first_name, last_name, phone)"
    )
    .eq("id", id)
    .single()

  if (!ride) {
    notFound()
  }

  // For drivers: verify this ride is assigned to them
  if (auth.role === "driver") {
    if (ride.driver_id !== auth.driverId) {
      notFound()
    }
  }

  // Fetch communication log with author names
  const { data: messages } = await supabase
    .from("communication_log")
    .select("id, message, created_at, profiles(display_name)")
    .eq("ride_id", id)
    .order("created_at", { ascending: true })

  const mappedMessages = (messages ?? []).map((msg) => {
    const author = msg.profiles as { display_name: string } | null
    return {
      id: msg.id,
      message: msg.message,
      created_at: msg.created_at,
      author: author ? { display_name: author.display_name } : null,
    }
  })

  // Extract joined data with safe access
  const patient = ride.patients as {
    id: string
    first_name: string
    last_name: string
    phone: string | null
  } | null

  const destination = ride.destinations as {
    id: string
    display_name: string
    street: string | null
    house_number: string | null
    postal_code: string | null
    city: string | null
  } | null

  const driver = ride.drivers as {
    id: string
    first_name: string
    last_name: string
    phone: string | null
  } | null

  const backHref = isStaff ? `/rides?date=${ride.date}` : `/my/rides?date=${ride.date}`
  const backLabel = isStaff ? "Zurueck zu Fahrten" : "Zurueck zu Meine Fahrten"

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fahrtdetails"
        backHref={backHref}
        backLabel={backLabel}
      />

      {/* Ride summary */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">Fahrt</CardTitle>
          <div className="flex items-center gap-2">
            <RideStatusBadge status={ride.status} />
            {isStaff && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/rides/${id}/edit`}>Bearbeiten</Link>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DetailItem label="Datum" value={formatDateDE(ride.date)} />
            <DetailItem
              label="Abholzeit"
              value={ride.pickup_time.slice(0, 5) + " Uhr"}
            />
            <DetailItem
              label="Richtung"
              value={RIDE_DIRECTION_LABELS[ride.direction]}
            />
            {ride.notes && <DetailItem label="Notizen" value={ride.notes} />}
          </dl>
        </CardContent>
      </Card>

      {/* Patient */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Patient</CardTitle>
        </CardHeader>
        <CardContent>
          {patient ? (
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DetailItem
                label="Name"
                value={`${patient.last_name}, ${patient.first_name}`}
              />
              {patient.phone && (
                <DetailItem label="Telefon" value={patient.phone} />
              )}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              Patientendaten nicht verfuegbar.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Destination */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ziel</CardTitle>
        </CardHeader>
        <CardContent>
          {destination ? (
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DetailItem label="Name" value={destination.display_name} />
              {(destination.street || destination.city) && (
                <DetailItem
                  label="Adresse"
                  value={formatAddress(destination)}
                />
              )}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              Zieldaten nicht verfuegbar.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Driver */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Fahrer</CardTitle>
        </CardHeader>
        <CardContent>
          {driver ? (
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DetailItem
                label="Name"
                value={`${driver.last_name}, ${driver.first_name}`}
              />
              {driver.phone && (
                <DetailItem label="Telefon" value={driver.phone} />
              )}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              Kein Fahrer zugewiesen.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Communication Log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Kommunikationslog</CardTitle>
        </CardHeader>
        <CardContent>
          <CommunicationTimeline messages={mappedMessages} rideId={id} />
        </CardContent>
      </Card>
    </div>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm">{value}</dd>
    </div>
  )
}

function formatAddress(dest: {
  street: string | null
  house_number: string | null
  postal_code: string | null
  city: string | null
}): string {
  const parts: string[] = []
  if (dest.street) {
    parts.push(dest.house_number ? `${dest.street} ${dest.house_number}` : dest.street)
  }
  if (dest.postal_code || dest.city) {
    const cityPart = [dest.postal_code, dest.city].filter(Boolean).join(" ")
    parts.push(cityPart)
  }
  return parts.join(", ")
}
