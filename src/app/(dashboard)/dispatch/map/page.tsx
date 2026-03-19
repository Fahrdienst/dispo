import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, ExternalLink } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/require-auth"
import { PageHeader } from "@/components/dashboard/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RideStatusBadge } from "@/components/shared/ride-status-badge"
import { retroStyleUrlParams } from "@/lib/maps/styles"
import { RIDE_DIRECTION_LABELS } from "@/lib/rides/constants"
import { formatDateDE, getToday } from "@/lib/utils/dates"
import type { Enums } from "@/lib/types/database"

export const metadata: Metadata = {
  title: "Dispatch Karte - Dispo",
}

interface DispatchMapPageProps {
  searchParams: Promise<{ date?: string }>
}

interface MapRide {
  id: string
  pickup_time: string
  status: Enums<"ride_status">
  direction: Enums<"ride_direction">
  driver_id: string | null
  patient_first_name: string
  patient_last_name: string
  patient_lat: number | null
  patient_lng: number | null
  destination_name: string
  destination_lat: number | null
  destination_lng: number | null
  driver_name: string | null
}

export default async function DispatchMapPage({
  searchParams,
}: DispatchMapPageProps) {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    redirect("/login")
  }

  const { date } = await searchParams
  const selectedDate = date ?? getToday()
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  const supabase = await createClient()

  const { data: ridesRaw } = await supabase
    .from("rides")
    .select(
      "id, pickup_time, status, direction, driver_id, patients!inner(first_name, last_name, lat, lng), destinations!inner(display_name, lat, lng), drivers(first_name, last_name)"
    )
    .eq("date", selectedDate)
    .eq("is_active", true)
    .not("status", "in", "(completed,cancelled,no_show)")
    .order("pickup_time")

  const rides: MapRide[] = (ridesRaw ?? []).map((r) => {
    const patient = r.patients as unknown as {
      first_name: string
      last_name: string
      lat: number | null
      lng: number | null
    }
    const dest = r.destinations as unknown as {
      display_name: string
      lat: number | null
      lng: number | null
    }
    const driver = r.drivers as { first_name: string; last_name: string } | null
    return {
      id: r.id,
      pickup_time: r.pickup_time,
      status: r.status,
      direction: r.direction,
      driver_id: r.driver_id,
      patient_first_name: patient.first_name,
      patient_last_name: patient.last_name,
      patient_lat: patient.lat,
      patient_lng: patient.lng,
      destination_name: dest.display_name,
      destination_lat: dest.lat,
      destination_lng: dest.lng,
      driver_name: driver
        ? `${driver.first_name} ${driver.last_name}`
        : null,
    }
  })

  // Collect geocoded coordinates for the static map
  const patientMarkers: string[] = []
  const destMarkers: string[] = []
  const seenPatientCoords = new Set<string>()
  const seenDestCoords = new Set<string>()

  for (const ride of rides) {
    if (ride.patient_lat != null && ride.patient_lng != null) {
      const key = `${ride.patient_lat},${ride.patient_lng}`
      if (!seenPatientCoords.has(key)) {
        seenPatientCoords.add(key)
        patientMarkers.push(key)
      }
    }
    if (ride.destination_lat != null && ride.destination_lng != null) {
      const key = `${ride.destination_lat},${ride.destination_lng}`
      if (!seenDestCoords.has(key)) {
        seenDestCoords.add(key)
        destMarkers.push(key)
      }
    }
  }

  const totalMarkers = patientMarkers.length + destMarkers.length

  // Build Static Maps URL
  let mapUrl: string | null = null
  if (apiKey && totalMarkers > 0) {
    const params = new URLSearchParams({
      size: "640x480",
      scale: "2",
      maptype: "roadmap",
      key: apiKey,
    })

    mapUrl = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`
    mapUrl += retroStyleUrlParams()

    if (patientMarkers.length > 0) {
      mapUrl += `&markers=${encodeURIComponent(`color:red|label:H|${patientMarkers.join("|")}`)}`
    }
    if (destMarkers.length > 0) {
      mapUrl += `&markers=${encodeURIComponent(`color:blue|label:Z|${destMarkers.join("|")}`)}`
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dispatch Karte"
        description={`Alle Fahrten am ${formatDateDE(selectedDate)}`}
        backHref={`/dispatch?date=${selectedDate}`}
        backLabel="Zurueck zur Disposition"
      />

      {/* Map */}
      {mapUrl ? (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Uebersichtskarte
              </CardTitle>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden="true" />
                  Patienten ({patientMarkers.length})
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" aria-hidden="true" />
                  Ziele ({destMarkers.length})
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mapUrl}
              alt={`Dispatch-Karte fuer ${selectedDate}`}
              width={640}
              height={480}
              loading="eager"
              className="h-[320px] w-full rounded-b-lg object-cover sm:h-[480px]"
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex min-h-[200px] items-center justify-center p-6">
            <p className="text-muted-foreground">
              {!apiKey
                ? "Google Maps API-Key nicht konfiguriert."
                : "Keine geocodierten Standorte fuer diesen Tag."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Ride List with links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {rides.length} {rides.length === 1 ? "Fahrt" : "Fahrten"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-4 pt-0">
          {rides.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Keine aktiven Fahrten fuer diesen Tag.
            </p>
          ) : (
            rides.map((ride) => (
              <Link
                key={ride.id}
                href={`/rides/${ride.id}`}
                className="flex items-center justify-between rounded-md border px-4 py-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold">
                      {ride.pickup_time.substring(0, 5)}
                    </span>
                    <span className="text-sm font-medium">
                      {ride.patient_last_name}, {ride.patient_first_name}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {ride.destination_name}
                    {" \u2013 "}
                    {RIDE_DIRECTION_LABELS[ride.direction]}
                  </span>
                  {ride.driver_name ? (
                    <span className="text-xs text-muted-foreground">
                      Fahrer: {ride.driver_name}
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-amber-700">
                      Kein Fahrer zugewiesen
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <RideStatusBadge status={ride.status} />
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
