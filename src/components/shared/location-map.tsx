"use client"

import { APIProvider, Map, AdvancedMarker } from "@vis.gl/react-google-maps"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RETRO_MAP_STYLES } from "@/lib/maps/styles"

interface LocationMapProps {
  lat: number | null
  lng: number | null
  label?: string
  geocodeStatus?: string
}

export function LocationMap({ lat, lng, label, geocodeStatus }: LocationMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  if (lat != null && lng != null && apiKey) {
    const center = { lat, lng }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Standort</CardTitle>
        </CardHeader>
        <CardContent>
          <APIProvider apiKey={apiKey}>
            <Map
              className="h-[300px] w-full rounded-md"
              defaultCenter={center}
              defaultZoom={15}
              styles={RETRO_MAP_STYLES}
              disableDefaultUI
              zoomControl
              aria-label={label ?? "Kartenansicht"}
            >
              <AdvancedMarker position={center} title={label} />
            </Map>
          </APIProvider>
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
