import { MapPin } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { retroStyleUrlParams } from "@/lib/maps/styles"

interface RideDetailMapProps {
  originLat: number | null
  originLng: number | null
  destLat: number | null
  destLng: number | null
}

async function fetchRoutePolyline(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  apiKey: string
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/directions/json?origin=${originLat},${originLng}&destination=${destLat},${destLng}&mode=driving&key=${apiKey}`,
      { next: { revalidate: 86400 } }
    )
    if (!res.ok) return null
    const data = await res.json()
    const polyline = data.routes?.[0]?.overview_polyline?.points as string | undefined
    return polyline ?? null
  } catch {
    return null
  }
}

export async function RideDetailMap({
  originLat,
  originLng,
  destLat,
  destLng,
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

  const polyline = await fetchRoutePolyline(originLat, originLng, destLat, destLng, apiKey)

  const params = new URLSearchParams({
    size: "640x300",
    scale: "2",
    maptype: "roadmap",
    key: apiKey,
  })

  let url = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`
  url += retroStyleUrlParams()

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
          className="h-[200px] w-full rounded-b-lg object-cover sm:h-[300px]"
        />
      </CardContent>
    </Card>
  )
}
