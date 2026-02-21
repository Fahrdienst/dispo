"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface LocationMapProps {
  lat: number | null
  lng: number | null
  label?: string
  geocodeStatus?: string
}

export function LocationMap({ lat, lng, label, geocodeStatus }: LocationMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  if (lat != null && lng != null && apiKey) {
    const q = label ? `${lat},${lng}` : `${lat},${lng}`
    const src = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${q}&zoom=15`

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Standort</CardTitle>
        </CardHeader>
        <CardContent>
          <iframe
            className="h-[300px] w-full rounded-md border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src={src}
            title={label ?? "Kartenansicht"}
            allowFullScreen
          />
        </CardContent>
      </Card>
    )
  }

  const message =
    geocodeStatus === "failed"
      ? "Geocoding fehlgeschlagen. Bitte Adresse pruefen."
      : "Adresse wurde noch nicht geocodet."

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Standort</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  )
}
