import "server-only"

import { callMapsApi } from "./client"
import { PlaceDetailsFailedError } from "./errors"

const PLACE_DETAILS_API_URL =
  "https://maps.googleapis.com/maps/api/place/details/json"

interface PlaceDetailsResult {
  name: string
  formatted_address: string
  geometry: {
    location: {
      lat: number
      lng: number
    }
  }
  formatted_phone_number?: string
}

interface PlaceDetailsApiResponse {
  status: string
  error_message?: string
  result: PlaceDetailsResult
}

export interface PlaceDetails {
  name: string
  formatted_address: string
  lat: number
  lng: number
  phone?: string
}

/**
 * Fetches place details from Google Places API (server-side proxy).
 *
 * @returns PlaceDetails or null if place not found
 * @throws PlaceDetailsFailedError on API errors
 */
export async function getPlaceDetails(
  placeId: string
): Promise<PlaceDetails | null> {
  const data = await callMapsApi<PlaceDetailsApiResponse>(
    PLACE_DETAILS_API_URL,
    {
      place_id: placeId,
      fields: "name,formatted_address,geometry,formatted_phone_number",
    }
  )

  if (data.status === "ZERO_RESULTS" || data.status === "NOT_FOUND") {
    return null
  }

  const result = data.result
  if (!result) {
    throw new PlaceDetailsFailedError(
      "Place Details API returned OK but no result"
    )
  }

  return {
    name: result.name,
    formatted_address: result.formatted_address,
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    phone: result.formatted_phone_number ?? undefined,
  }
}
