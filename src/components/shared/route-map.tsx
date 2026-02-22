"use client"

import { useEffect, useState, useRef } from "react"
import { APIProvider, Map, useMap, useMapsLibrary } from "@vis.gl/react-google-maps"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RETRO_MAP_STYLES } from "@/lib/maps/styles"

interface RouteMapProps {
  originLat: number | null
  originLng: number | null
  destLat: number | null
  destLng: number | null
}

function DirectionsRoute({
  originLat,
  originLng,
  destLat,
  destLng,
}: {
  originLat: number
  originLng: number
  destLat: number
  destLng: number
}) {
  const map = useMap()
  const routesLib = useMapsLibrary("routes")
  const rendererRef = useRef<google.maps.DirectionsRenderer | null>(null)
  const [requested, setRequested] = useState(false)

  useEffect(() => {
    if (!map || !routesLib) return

    const service = new routesLib.DirectionsService()
    const renderer = new routesLib.DirectionsRenderer({
      map,
      suppressMarkers: false,
    })
    rendererRef.current = renderer

    if (!requested) {
      setRequested(true)
      service.route(
        {
          origin: { lat: originLat, lng: originLng },
          destination: { lat: destLat, lng: destLng },
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === google.maps.DirectionsStatus.OK && result) {
            renderer.setDirections(result)
          }
        }
      )
    }

    return () => {
      renderer.setMap(null)
    }
  }, [map, routesLib, originLat, originLng, destLat, destLng, requested])

  return null
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

  const centerLat = (originLat + destLat) / 2
  const centerLng = (originLng + destLng) / 2

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Route</CardTitle>
      </CardHeader>
      <CardContent>
        <APIProvider apiKey={apiKey}>
          <Map
            className="h-[250px] w-full rounded-md"
            defaultCenter={{ lat: centerLat, lng: centerLng }}
            defaultZoom={10}
            styles={RETRO_MAP_STYLES}
            disableDefaultUI
            zoomControl
            aria-label="Routenkarte"
          >
            <DirectionsRoute
              originLat={originLat}
              originLng={originLng}
              destLat={destLat}
              destLng={destLng}
            />
          </Map>
        </APIProvider>
      </CardContent>
    </Card>
  )
}
