import "server-only"

import { callMapsApi } from "./client"
import { DirectionsFailedError } from "./errors"
import type { GeoPoint, RouteResult } from "./types"

const DIRECTIONS_API_URL =
  "https://maps.googleapis.com/maps/api/directions/json"

interface DirectionsLeg {
  distance: { value: number }
  duration: { value: number }
}

interface DirectionsRoute {
  legs: DirectionsLeg[]
  overview_polyline: { points: string }
}

interface DirectionsApiResponse {
  status: string
  error_message?: string
  routes: DirectionsRoute[]
}

/**
 * Calculates driving route between two points via Google Directions API.
 *
 * @returns RouteResult with distance_meters, duration_seconds, and encoded polyline
 * @throws DirectionsFailedError if no route is found or API errors
 */
export async function getRoute(
  origin: GeoPoint,
  destination: GeoPoint
): Promise<RouteResult> {
  const data = await callMapsApi<DirectionsApiResponse>(DIRECTIONS_API_URL, {
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    mode: "driving",
  })

  const firstRoute = data.routes[0]
  if (!firstRoute) {
    throw new DirectionsFailedError("Directions API returned no routes")
  }

  const firstLeg = firstRoute.legs[0]
  if (!firstLeg) {
    throw new DirectionsFailedError(
      "Directions API returned route with no legs"
    )
  }

  return {
    distance_meters: firstLeg.distance.value,
    duration_seconds: firstLeg.duration.value,
    polyline: firstRoute.overview_polyline.points,
  }
}
