"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface RouteMapProps {
  originLat: number | null
  originLng: number | null
  destLat: number | null
  destLng: number | null
}

export function RouteMap({
  originLat,
  originLng,
  destLat,
  destLng,
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

  const src = `https://www.google.com/maps/embed/v1/directions?key=${apiKey}&origin=${originLat},${originLng}&destination=${destLat},${destLng}&mode=driving`

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Route</CardTitle>
      </CardHeader>
      <CardContent>
        <iframe
          className="h-[250px] w-full rounded-md border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          src={src}
          title="Routenkarte"
          allowFullScreen
        />
      </CardContent>
    </Card>
  )
}
