import { MapPin } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { retroStyleUrlParams } from "@/lib/maps/styles"
import { getPaddedVisibleParam } from "@/lib/maps/utils"

interface RideDetailMapProps {
  originLat: number | null
  originLng: number | null
  destLat: number | null
  destLng: number | null
  polyline?: string | null
}

export function RideDetailMap({
  originLat,
  originLng,
  destLat,
  destLng,
  polyline: initialPolyline,
}: RideDetailMapProps) {
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

  const polyline = initialPolyline ?? null

  const params = new URLSearchParams({
    size: "640x300",
    scale: "2",
    maptype: "roadmap",
    key: apiKey,
  })

  let url = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`
  url += retroStyleUrlParams()

  // Force a padded bounding box around the endpoints so both pins stay fully
  // visible with margin instead of being clipped at the image edge.
  url += getPaddedVisibleParam([`${originLat},${originLng}`, `${destLat},${destLng}`])

  if (polyline) {
    url += `&path=${encodeURIComponent(`color:0x4285F4FF|weight:5|enc:${polyline}`)}`
  }

  url += `&markers=${encodeURIComponent(`color:red|label:H|${originLat},${originLng}`)}`
  url += `&markers=${encodeURIComponent(`color:blue|label:Z|${destLat},${destLng}`)}`

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
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
              Abholung
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
              Ziel
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="Route"
          width={640}
          height={300}
          loading="lazy"
          className="aspect-[32/15] w-full rounded-b-lg bg-muted object-contain"
        />
      </CardContent>
    </Card>
  )
}
