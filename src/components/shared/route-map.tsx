import { MapPin } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface RouteMapProps {
  originLat: number | null
  originLng: number | null
  destLat: number | null
  destLng: number | null
  polyline?: string | null
}

export function RouteMap({
  originLat,
  originLng,
  destLat,
  destLng,
  polyline,
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
    size: "640x250",
    scale: "2",
    maptype: "roadmap",
    key: apiKey,
  })

  let url = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`

  url += `&markers=${encodeURIComponent(`color:red|label:H|${originLat},${originLng}`)}`
  url += `&markers=${encodeURIComponent(`color:blue|label:Z|${destLat},${destLng}`)}`

  if (polyline) {
    url += `&path=${encodeURIComponent(`weight:4|color:0x0000ffcc|enc:${polyline}`)}`
  }

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
        <img
          src={url}
          alt="Kartenansicht der Route zwischen Abholort und Ziel"
          width={640}
          height={250}
          loading="lazy"
          className="h-[200px] w-full rounded-b-lg object-cover sm:h-[250px]"
        />
      </CardContent>
    </Card>
  )
}
