import { MapPin } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export async function DashboardMap() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey) return null

  const supabase = await createClient()
  const today = new Date().toISOString().split("T")[0]!
  const TERMINAL_STATUSES = "(completed,cancelled,no_show)"

  const [patientRes, destinationRes] = await Promise.all([
    supabase
      .from("rides")
      .select("patients!inner(id, lat, lng)")
      .eq("date", today)
      .eq("is_active", true)
      .not("status", "in", TERMINAL_STATUSES),
    supabase
      .from("rides")
      .select("destinations!inner(id, display_name, lat, lng)")
      .eq("date", today)
      .eq("is_active", true)
      .not("status", "in", TERMINAL_STATUSES),
  ])

  // Deduplicate by coordinate string
  const patientCoords = [
    ...new Set(
      (patientRes.data ?? [])
        .map((r) => {
          const p = r.patients as unknown as { id: string; lat: number | null; lng: number | null }
          return p?.lat != null && p?.lng != null ? `${p.lat},${p.lng}` : null
        })
        .filter((v): v is string => v !== null)
    ),
  ]

  const destCoords = [
    ...new Set(
      (destinationRes.data ?? [])
        .map((r) => {
          const d = r.destinations as unknown as {
            id: string
            display_name: string
            lat: number | null
            lng: number | null
          }
          return d?.lat != null && d?.lng != null ? `${d.lat},${d.lng}` : null
        })
        .filter((v): v is string => v !== null)
    ),
  ]

  const totalMarkers = patientCoords.length + destCoords.length

  if (totalMarkers === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Heutige Standorte</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex min-h-[180px] items-center justify-center rounded-md border border-dashed">
            <p className="text-sm text-muted-foreground">
              Keine Standortdaten fuer heute
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Build Static Maps URL
  const params = new URLSearchParams({
    size: "640x400",
    scale: "2",
    maptype: "roadmap",
    key: apiKey,
  })

  // Suppress POI and transit clutter
  const styles = [
    "feature:poi|visibility:off",
    "feature:transit|visibility:off",
  ]

  let url = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`
  for (const s of styles) {
    url += `&style=${encodeURIComponent(s)}`
  }

  if (patientCoords.length > 0) {
    url += `&markers=${encodeURIComponent(`color:red|label:H|${patientCoords.join("|")}`)}`
  }
  if (destCoords.length > 0) {
    url += `&markers=${encodeURIComponent(`color:blue|label:Z|${destCoords.join("|")}`)}`
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Heutige Standorte</CardTitle>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
              Patienten ({patientCoords.length})
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
              Ziele ({destCoords.length})
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="Heutige Standorte"
          width={640}
          height={400}
          loading="lazy"
          className="h-[280px] w-full rounded-b-lg object-cover sm:h-[400px]"
        />
      </CardContent>
    </Card>
  )
}
