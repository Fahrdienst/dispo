import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { retroStyleUrlParams } from "@/lib/maps/styles"

interface LocationMapProps {
  lat: number | null
  lng: number | null
  label?: string
  geocodeStatus?: string
}

export function LocationMap({ lat, lng, label, geocodeStatus }: LocationMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  if (lat != null && lng != null && apiKey) {
    const params = new URLSearchParams({
      center: `${lat},${lng}`,
      zoom: "15",
      size: "640x300",
      scale: "2",
      markers: `color:red|label:S|${lat},${lng}`,
      key: apiKey,
    })

    const styleParams = retroStyleUrlParams()
    const url = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}${styleParams ? `&${styleParams}` : ""}`

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Standort</CardTitle>
        </CardHeader>
        <CardContent>
          <img
            src={url}
            alt={label ?? "Kartenansicht"}
            className="h-[300px] w-full rounded-md object-cover"
            loading="lazy"
          />
        </CardContent>
      </Card>
    )
  }

  const message =
    geocodeStatus === "failed"
      ? "Geocoding fehlgeschlagen. Bitte Adresse prüfen."
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
