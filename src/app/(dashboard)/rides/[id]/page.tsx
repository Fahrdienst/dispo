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
import { RouteMap } from "@/components/shared/route-map"
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

function formatTime(time: string | null): string | null {
  if (!time) return null
  return time.slice(0, 5) + " Uhr"
}

function formatDurationDE(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `~${minutes} Min.`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes > 0
    ? `~${hours} Std. ${remainingMinutes} Min.`
    : `~${hours} Std.`
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
      "*, patients(id, first_name, last_name, phone, lat, lng), destinations(id, display_name, street, house_number, postal_code, city, lat, lng), drivers(id, first_name, last_name, phone)"
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

  // Fetch linked rides (children = return rides linked to this outbound ride)
  const { data: childRides } = await supabase
    .from("rides")
    .select("id, pickup_time, direction, status, date")
    .eq("parent_ride_id", id)
    .order("pickup_time")

  // Fetch parent ride if this is a return ride
  let parentRide: {
    id: string
    pickup_time: string
    direction: string
    status: string
    date: string
  } | null = null
  if (ride.parent_ride_id) {
    const { data } = await supabase
      .from("rides")
      .select("id, pickup_time, direction, status, date")
      .eq("id", ride.parent_ride_id)
      .single()
    parentRide = data
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
    lat: number | null
    lng: number | null
  } | null

  const destination = ride.destinations as {
    id: string
    display_name: string
    street: string | null
    house_number: string | null
    postal_code: string | null
    city: string | null
    lat: number | null
    lng: number | null
  } | null

  const driver = ride.drivers as {
    id: string
    first_name: string
    last_name: string
    phone: string | null
  } | null

  const backHref = isStaff
    ? `/rides?date=${ride.date}`
    : `/my/rides?date=${ride.date}`
  const backLabel = isStaff
    ? "Zurueck zu Fahrten"
    : "Zurueck zu Meine Fahrten"

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
            {ride.appointment_time && (
              <DetailItem
                label="Terminbeginn"
                value={formatTime(ride.appointment_time) ?? ""}
              />
            )}
            {ride.appointment_end_time && (
              <DetailItem
                label="Terminende"
                value={formatTime(ride.appointment_end_time) ?? ""}
              />
            )}
            {ride.return_pickup_time && (
              <DetailItem
                label="Rueckfahrt-Abholzeit"
                value={formatTime(ride.return_pickup_time) ?? ""}
              />
            )}
            {ride.notes && <DetailItem label="Notizen" value={ride.notes} />}
          </dl>
        </CardContent>
      </Card>

      {/* Route & Price info (ADR-010) */}
      {(ride.distance_meters != null ||
        ride.calculated_price != null ||
        ride.price_override != null) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Route und Preis</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {ride.distance_meters != null && (
                <DetailItem
                  label="Distanz"
                  value={`${(ride.distance_meters / 1000).toFixed(1)} km`}
                />
              )}
              {ride.duration_seconds != null && (
                <DetailItem
                  label="Geschaetzte Fahrzeit"
                  value={formatDurationDE(ride.duration_seconds)}
                />
              )}
              {ride.calculated_price != null && (
                <DetailItem
                  label="Berechneter Preis"
                  value={`CHF ${Number(ride.calculated_price).toFixed(2)}`}
                />
              )}
              {ride.price_override != null && (
                <>
                  <DetailItem
                    label="Manueller Preis"
                    value={`CHF ${Number(ride.price_override).toFixed(2)}`}
                  />
                  {ride.price_override_reason && (
                    <DetailItem
                      label="Begruendung"
                      value={ride.price_override_reason}
                    />
                  )}
                </>
              )}
              {(ride.calculated_price != null ||
                ride.price_override != null) && (
                <DetailItem
                  label="Effektiver Preis"
                  value={`CHF ${Number(
                    ride.price_override ?? ride.calculated_price ?? 0
                  ).toFixed(2)}`}
                />
              )}
            </dl>
          </CardContent>
        </Card>
      )}

      {/* Route Map */}
      <RouteMap
        originLat={patient?.lat ?? null}
        originLng={patient?.lng ?? null}
        destLat={destination?.lat ?? null}
        destLng={destination?.lng ?? null}
      />

      {/* Linked rides */}
      {(parentRide || (childRides && childRides.length > 0)) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Verknuepfte Fahrten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {parentRide && (
              <LinkedRideCard
                label="Hinfahrt"
                ride={parentRide}
              />
            )}
            {childRides?.map((child) => (
              <LinkedRideCard
                key={child.id}
                label="Heimfahrt"
                ride={child}
              />
            ))}
          </CardContent>
        </Card>
      )}

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

function LinkedRideCard({
  label,
  ride,
}: {
  label: string
  ride: {
    id: string
    pickup_time: string
    direction: string
    status: string
    date: string
  }
}) {
  return (
    <Link
      href={`/rides/${ride.id}`}
      className="block rounded-md border px-4 py-3 transition-colors hover:bg-muted/50"
    >
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium">{label}</span>
          <span className="ml-2 text-sm text-muted-foreground">
            {ride.pickup_time.slice(0, 5)} Uhr
          </span>
        </div>
        <RideStatusBadge status={ride.status as Parameters<typeof RideStatusBadge>[0]["status"]} />
      </div>
    </Link>
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
    parts.push(
      dest.house_number ? `${dest.street} ${dest.house_number}` : dest.street
    )
  }
  if (dest.postal_code || dest.city) {
    const cityPart = [dest.postal_code, dest.city].filter(Boolean).join(" ")
    parts.push(cityPart)
  }
  return parts.join(", ")
}
