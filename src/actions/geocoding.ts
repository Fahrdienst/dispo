"use server"

import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/require-auth"
import { geocodeAddress } from "@/lib/maps/geocode"
import type { AddressInput } from "@/lib/maps/types"
import type { ActionResult } from "@/actions/shared"

interface RetryResult {
  patients_processed: number
  patients_success: number
  destinations_processed: number
  destinations_success: number
}

/**
 * Re-geocodes all patients and destinations with failed, pending, or null
 * geocode_status that have complete address data.
 *
 * Uses a single Supabase client for efficiency instead of calling
 * geocodeAndUpdateRecord (which creates its own client per call).
 */
export async function retryFailedGeocoding(): Promise<
  ActionResult<RetryResult>
> {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: "Nicht berechtigt" }
  }

  const supabase = await createClient()
  let patientsProcessed = 0
  let patientsSuccess = 0
  let destinationsProcessed = 0
  let destinationsSuccess = 0

  // Fetch patients with failed/pending/null geocode_status and complete addresses
  const { data: patients, error: patientsError } = await supabase
    .from("patients")
    .select("id, street, house_number, postal_code, city")
    .or("geocode_status.eq.failed,geocode_status.eq.pending,geocode_status.is.null")
    .not("street", "is", null)
    .not("house_number", "is", null)
    .not("postal_code", "is", null)
    .not("city", "is", null)

  if (patientsError) {
    console.error("Failed to fetch patients for re-geocoding:", patientsError.message)
    return { success: false, error: "Patienten konnten nicht geladen werden" }
  }

  for (const patient of patients) {
    patientsProcessed++
    const address: AddressInput = {
      street: patient.street!,
      house_number: patient.house_number!,
      postal_code: patient.postal_code!,
      city: patient.city!,
    }
    const now = new Date().toISOString()

    try {
      const result = await geocodeAddress(address)

      if (result) {
        const { error } = await supabase
          .from("patients")
          .update({
            lat: result.lat,
            lng: result.lng,
            place_id: result.place_id,
            formatted_address: result.formatted_address,
            geocode_status: "success",
            geocode_updated_at: now,
          })
          .eq("id", patient.id)

        if (error) {
          console.error(`Failed to update patient ${patient.id} with geocode result:`, error.message)
        } else {
          patientsSuccess++
        }
      } else {
        // ZERO_RESULTS
        await supabase
          .from("patients")
          .update({ geocode_status: "failed", geocode_updated_at: now })
          .eq("id", patient.id)
      }
    } catch (err) {
      console.error(`Re-geocode failed for patient ${patient.id}:`, err)
      try {
        await supabase
          .from("patients")
          .update({ geocode_status: "failed", geocode_updated_at: now })
          .eq("id", patient.id)
      } catch (updateErr) {
        console.error(`Failed to mark patient ${patient.id} as geocode failed:`, updateErr)
      }
    }
  }

  // Fetch destinations with failed/pending/null geocode_status and complete addresses
  const { data: destinations, error: destinationsError } = await supabase
    .from("destinations")
    .select("id, street, house_number, postal_code, city")
    .or("geocode_status.eq.failed,geocode_status.eq.pending,geocode_status.is.null")
    .not("street", "is", null)
    .not("house_number", "is", null)
    .not("postal_code", "is", null)
    .not("city", "is", null)

  if (destinationsError) {
    console.error("Failed to fetch destinations for re-geocoding:", destinationsError.message)
    return { success: false, error: "Ziele konnten nicht geladen werden" }
  }

  for (const destination of destinations) {
    destinationsProcessed++
    const address: AddressInput = {
      street: destination.street!,
      house_number: destination.house_number!,
      postal_code: destination.postal_code!,
      city: destination.city!,
    }
    const now = new Date().toISOString()

    try {
      const result = await geocodeAddress(address)

      if (result) {
        const { error } = await supabase
          .from("destinations")
          .update({
            lat: result.lat,
            lng: result.lng,
            place_id: result.place_id,
            formatted_address: result.formatted_address,
            geocode_status: "success",
            geocode_updated_at: now,
          })
          .eq("id", destination.id)

        if (error) {
          console.error(`Failed to update destination ${destination.id} with geocode result:`, error.message)
        } else {
          destinationsSuccess++
        }
      } else {
        // ZERO_RESULTS
        await supabase
          .from("destinations")
          .update({ geocode_status: "failed", geocode_updated_at: now })
          .eq("id", destination.id)
      }
    } catch (err) {
      console.error(`Re-geocode failed for destination ${destination.id}:`, err)
      try {
        await supabase
          .from("destinations")
          .update({ geocode_status: "failed", geocode_updated_at: now })
          .eq("id", destination.id)
      } catch (updateErr) {
        console.error(`Failed to mark destination ${destination.id} as geocode failed:`, updateErr)
      }
    }
  }

  return {
    success: true,
    data: {
      patients_processed: patientsProcessed,
      patients_success: patientsSuccess,
      destinations_processed: destinationsProcessed,
      destinations_success: destinationsSuccess,
    },
  }
}
