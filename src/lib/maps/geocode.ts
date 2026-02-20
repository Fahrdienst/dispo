import "server-only"

import { callMapsApi } from "./client"
import { GeocodeFailedError } from "./errors"
import type { AddressInput, GeocodeResult } from "./types"
import { createClient } from "@/lib/supabase/server"

const GEOCODING_API_URL = "https://maps.googleapis.com/maps/api/geocode/json"

interface GeocodeApiResponse {
  status: string
  error_message?: string
  results: Array<{
    geometry: {
      location: {
        lat: number
        lng: number
      }
    }
    place_id: string
    formatted_address: string
  }>
}

/**
 * Geocodes a Swiss address via Google Geocoding API.
 *
 * @returns GeocodeResult with coordinates, place_id, formatted_address
 * @returns null if no results found (ZERO_RESULTS)
 * @throws GeocodeFailedError on API errors
 */
export async function geocodeAddress(
  address: AddressInput
): Promise<GeocodeResult | null> {
  const addressString = `${address.street} ${address.house_number}, ${address.postal_code} ${address.city}, Schweiz`

  const data = await callMapsApi<GeocodeApiResponse>(GEOCODING_API_URL, {
    address: addressString,
    components: "country:CH",
  })

  if (data.status === "ZERO_RESULTS") {
    return null
  }

  const firstResult = data.results[0]
  if (!firstResult) {
    throw new GeocodeFailedError("Geocoding returned OK but no results")
  }

  return {
    lat: firstResult.geometry.location.lat,
    lng: firstResult.geometry.location.lng,
    place_id: firstResult.place_id,
    formatted_address: firstResult.formatted_address,
  }
}

/**
 * Geocodes an address and updates the corresponding record in the database.
 * Designed for fire-and-forget usage after patient/destination create/update.
 *
 * On success: sets lat, lng, place_id, formatted_address, geocode_status='success'
 * On failure: sets geocode_status='failed', geocode_updated_at
 */
export async function geocodeAndUpdateRecord(
  table: "patients" | "destinations",
  recordId: string,
  address: AddressInput
): Promise<void> {
  const supabase = await createClient()
  const now = new Date().toISOString()

  try {
    const result = await geocodeAddress(address)

    if (result) {
      const { error } = await supabase
        .from(table)
        .update({
          lat: result.lat,
          lng: result.lng,
          place_id: result.place_id,
          formatted_address: result.formatted_address,
          geocode_status: "success",
          geocode_updated_at: now,
        })
        .eq("id", recordId)

      if (error) {
        console.error(
          `Failed to update ${table} ${recordId} with geocode result:`,
          error.message
        )
      }
    } else {
      // ZERO_RESULTS: mark as failed
      const { error } = await supabase
        .from(table)
        .update({
          geocode_status: "failed",
          geocode_updated_at: now,
        })
        .eq("id", recordId)

      if (error) {
        console.error(
          `Failed to update ${table} ${recordId} geocode_status:`,
          error.message
        )
      }
    }
  } catch (err) {
    console.error(`Geocoding failed for ${table} ${recordId}:`, err)

    // Best-effort: mark as failed in DB
    try {
      await supabase
        .from(table)
        .update({
          geocode_status: "failed",
          geocode_updated_at: now,
        })
        .eq("id", recordId)
    } catch (updateErr) {
      console.error(
        `Failed to mark ${table} ${recordId} as geocode failed:`,
        updateErr
      )
    }
  }
}
