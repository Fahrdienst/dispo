import { MapPin } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { retroStyleUrlParams } from "@/lib/maps/styles"
import { cn } from "@/lib/utils"

interface RouteMapProps {
  originLat: number | null
  originLng: number | null
  destLat: number | null
  destLng: number | null
  polyline?: string | null
  /** Static-map height in px (250 in the ride form preview, 300 on the detail page). */
  height?: number
  /** Apply the retro map styling used on the ride detail page. */
  retroStyle?: boolean
}

/**
 * Static Google Map showing the route between pickup and destination.
 *
 * Renders entirely in the browser via the Static Maps API with the public
 * (referer-restricted) key — no server-side Directions call. When a persisted
 * `polyline` is supplied it draws the route line; otherwise just the markers.
 */
export function RouteMap({
  originLat,
  originLng,
  destLat,
  destLng,
  polyline,
  height = 250,
  retroStyle = false,
}: RouteMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  if (
    originLat == null ||
    originLng == null ||
    destLat == null ||
    destLng == null ||
    !apiKey
  ) {
    return null
  }

  const params = new URLSearchParams({
    size: `640x${height}`,
    scale: "2",
    maptype: "roadmap",
    key: apiKey,
  })

  let url = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`
  if (retroStyle) {
    url += retroStyleUrlParams()
  }

  url += `&markers=${encodeURIComponent(`color:red|label:H|${originLat},${originLng}`)}`
  url += `&markers=${encodeURIComponent(`color:blue|label:Z|${destLat},${destLng}`)}`

  if (polyline) {
    url += `&path=${encodeURIComponent(`color:0x4285F4FF|weight:5|enc:${polyline}`)}`
  }

  // Tailwind needs static class strings, so pick from known heights.
  const smHeightClass = height >= 300 ? "sm:h-[300px]" : "sm:h-[250px]"

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Route</CardTitle>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden="true" />
              Abholung
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" aria-hidden="true" />
              Ziel
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="Kartenansicht der Route zwischen Abholort und Ziel"
          width={640}
          height={height}
          loading="lazy"
          className={cn("h-[200px] w-full rounded-b-lg object-cover", smHeightClass)}
        />
      </CardContent>
    </Card>
  )
}
