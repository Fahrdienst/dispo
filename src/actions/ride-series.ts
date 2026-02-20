"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/require-auth"
import {
  rideSeriesSchema,
  generateRidesSchema,
} from "@/lib/validations/ride-series"
import {
  generateDatesForSeries,
  expandDirections,
} from "@/lib/ride-series/generate"
import type { ActionResult } from "@/actions/shared"
import type { Tables } from "@/lib/types/database"

export async function createRideSeries(
  _prevState: ActionResult<Tables<"ride_series">> | null,
  formData: FormData
): Promise<ActionResult<Tables<"ride_series">>> {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const raw = {
    ...Object.fromEntries(formData),
    days_of_week: formData.getAll("days_of_week"),
  }
  const result = rideSeriesSchema.safeParse(raw)

  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("ride_series")
    .insert({
      patient_id: result.data.patient_id,
      destination_id: result.data.destination_id,
      recurrence_type: result.data.recurrence_type,
      days_of_week:
        result.data.days_of_week.length > 0
          ? result.data.days_of_week
          : null,
      pickup_time: result.data.pickup_time,
      direction: result.data.direction,
      start_date: result.data.start_date,
      end_date: result.data.end_date ?? null,
      notes: result.data.notes ?? null,
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/ride-series")
  redirect("/ride-series")
}

export async function updateRideSeries(
  id: string,
  _prevState: ActionResult<Tables<"ride_series">> | null,
  formData: FormData
): Promise<ActionResult<Tables<"ride_series">>> {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const raw = {
    ...Object.fromEntries(formData),
    days_of_week: formData.getAll("days_of_week"),
  }
  const result = rideSeriesSchema.safeParse(raw)

  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("ride_series")
    .update({
      patient_id: result.data.patient_id,
      destination_id: result.data.destination_id,
      recurrence_type: result.data.recurrence_type,
      days_of_week:
        result.data.days_of_week.length > 0
          ? result.data.days_of_week
          : null,
      pickup_time: result.data.pickup_time,
      direction: result.data.direction,
      start_date: result.data.start_date,
      end_date: result.data.end_date ?? null,
      notes: result.data.notes ?? null,
    })
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/ride-series")
  redirect("/ride-series")
}

export async function toggleRideSeriesActive(
  id: string,
  isActive: boolean
): Promise<ActionResult> {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("ride_series")
    .update({ is_active: isActive })
    .eq("id", id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/ride-series")
  return { success: true, data: undefined }
}

export async function generateRidesFromSeries(
  _prevState: ActionResult<{ count: number }> | null,
  formData: FormData
): Promise<ActionResult<{ count: number }>> {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const raw = Object.fromEntries(formData)
  const result = generateRidesSchema.safeParse(raw)

  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    }
  }

  const supabase = await createClient()

  // Load the series
  const { data: series, error: seriesError } = await supabase
    .from("ride_series")
    .select("*")
    .eq("id", result.data.series_id)
    .single()

  if (seriesError || !series) {
    return { success: false, error: "Fahrtserie nicht gefunden" }
  }

  if (!series.is_active) {
    return { success: false, error: "Fahrtserie ist inaktiv" }
  }

  // Generate dates
  const dates = generateDatesForSeries(
    {
      recurrence_type: series.recurrence_type,
      days_of_week: series.days_of_week,
      start_date: series.start_date,
      end_date: series.end_date,
    },
    result.data.from_date,
    result.data.to_date
  )

  if (dates.length === 0) {
    return {
      success: true,
      data: { count: 0 },
    }
  }

  // Expand directions
  const directions = expandDirections(series.direction)

  // Build ride objects and insert individually to skip duplicates
  let insertedCount = 0
  for (const date of dates) {
    for (const direction of directions) {
      const { error: insertError } = await supabase.from("rides").insert({
        patient_id: series.patient_id,
        destination_id: series.destination_id,
        ride_series_id: series.id,
        date,
        pickup_time: series.pickup_time,
        direction,
        status: "unplanned",
      })
      if (!insertError) {
        insertedCount++
      }
      // Unique constraint violation → skip silently (duplicate)
    }
  }

  revalidatePath("/rides")
  revalidatePath("/ride-series")
  return { success: true, data: { count: insertedCount } }
}
