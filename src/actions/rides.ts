"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/require-auth"
import {
  rideSchema,
  addMinutesToTime,
  DEFAULT_RETURN_BUFFER_MINUTES,
} from "@/lib/validations/rides"
import { assertTransitionForRole } from "@/lib/rides/status-machine"
import { invalidateTokensForRide } from "@/lib/mail/tokens"
import { sendDriverNotification } from "@/lib/mail/send-driver-notification"
import {
  generateDatesForSeries,
  expandDirections,
} from "@/lib/ride-series/generate"
import type { ActionResult } from "@/actions/shared"
import type { Tables, Enums } from "@/lib/types/database"

/** Inline Zod schema for series fields extracted from the ride form. */
const seriesFieldsSchema = z.object({
  recurrence_type: z.enum(["daily", "weekly", "biweekly", "monthly"]),
  days_of_week: z.array(
    z.enum([
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ])
  ),
  end_date: z
    .string()
    .transform((v) => (v === "" ? null : v))
    .nullable(),
})

export async function createRide(
  _prevState: ActionResult<Tables<"rides">> | null,
  formData: FormData
): Promise<ActionResult<Tables<"rides">>> {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  // Delegate to series creation if the series toggle is enabled
  if (formData.get("enable_series") === "true") {
    return createRideWithSeries(formData)
  }

  const raw = Object.fromEntries(formData)
  const result = rideSchema.safeParse(raw)

  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    }
  }

  const {
    create_return_ride,
    price_override,
    price_override_reason,
    ...rideData
  } = result.data
  const status: Enums<"ride_status"> = rideData.driver_id
    ? "planned"
    : "unplanned"

  const supabase = await createClient()

  // Calculate price before insert (inline, not fire-and-forget)
  let priceFields: {
    distance_meters?: number
    duration_seconds?: number
    calculated_price?: number
    fare_rule_id?: string
    price_override?: number | null
    price_override_reason?: string | null
  } = {}

  // Include manual override if provided
  if (price_override != null) {
    priceFields.price_override = price_override
    priceFields.price_override_reason = price_override_reason ?? null
  }

  // Attempt automatic price calculation
  try {
    const [patientRes, destRes] = await Promise.all([
      supabase
        .from("patients")
        .select("postal_code, lat, lng, geocode_status")
        .eq("id", rideData.patient_id)
        .single(),
      supabase
        .from("destinations")
        .select("postal_code, lat, lng, geocode_status")
        .eq("id", rideData.destination_id)
        .single(),
    ])

    const patient = patientRes.data
    const dest = destRes.data

    if (
      patient?.postal_code &&
      dest?.postal_code &&
      patient.lat != null &&
      patient.lng != null &&
      dest.lat != null &&
      dest.lng != null
    ) {
      const { calculateRidePrice } = await import(
        "@/lib/billing/calculate-price"
      )
      const priceResult = await calculateRidePrice(
        patient.postal_code,
        dest.postal_code,
        { lat: patient.lat, lng: patient.lng },
        { lat: dest.lat, lng: dest.lng },
        rideData.date
      )

      if (priceResult) {
        priceFields = {
          ...priceFields,
          distance_meters: priceResult.distance_meters,
          duration_seconds: priceResult.duration_seconds,
          calculated_price: priceResult.calculated_price,
          fare_rule_id: priceResult.fare_rule_id,
        }
      }
    }
  } catch (err: unknown) {
    // Price calculation is best-effort; don't block ride creation
    console.error("Price calculation failed during createRide:", err)
  }

  // 1. Create the outbound ride
  const { data: outboundRide, error } = await supabase
    .from("rides")
    .insert({ ...rideData, ...priceFields, status })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // 2. Optionally create return ride
  if (create_return_ride && rideData.direction === "outbound") {
    const returnPickupTime =
      rideData.return_pickup_time ??
      (rideData.appointment_end_time
        ? addMinutesToTime(
            rideData.appointment_end_time,
            DEFAULT_RETURN_BUFFER_MINUTES
          )
        : null)

    if (returnPickupTime) {
      const { error: returnError } = await supabase.from("rides").insert({
        patient_id: rideData.patient_id,
        destination_id: rideData.destination_id,
        date: rideData.date,
        pickup_time: returnPickupTime,
        direction: "return" as const,
        status: "unplanned" as const,
        parent_ride_id: outboundRide.id,
      })

      if (returnError) {
        // Outbound ride was created successfully. Log return ride error
        // but still redirect -- the dispatcher can create it manually.
        console.error("Failed to create return ride:", returnError.message)
      }
    }
  }

  revalidatePath("/rides")
  revalidatePath("/dispatch")
  redirect(`/rides?date=${rideData.date}`)
}

/**
 * Internal helper called from createRide when the series toggle is enabled.
 * Creates a ride_series record, the initial ride, and generates additional rides.
 */
async function createRideWithSeries(
  formData: FormData
): Promise<ActionResult<Tables<"rides">>> {
  // 1. Validate ride data
  const raw = Object.fromEntries(formData)
  const rideResult = rideSchema.safeParse(raw)

  if (!rideResult.success) {
    return {
      success: false,
      fieldErrors: rideResult.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    }
  }

  // 2. Validate series-specific fields
  const seriesRaw = {
    recurrence_type: formData.get("recurrence_type") as string,
    days_of_week: formData.getAll("days_of_week") as string[],
    end_date: (formData.get("series_end_date") as string) || null,
  }
  const seriesResult = seriesFieldsSchema.safeParse(seriesRaw)

  if (!seriesResult.success) {
    return {
      success: false,
      error: "Ungueltige Serienfelder: " +
        seriesResult.error.issues.map((i) => i.message).join(", "),
    }
  }

  const {
    create_return_ride,
    price_override,
    price_override_reason,
    ...rideData
  } = rideResult.data
  const seriesData = seriesResult.data
  const status: Enums<"ride_status"> = rideData.driver_id
    ? "planned"
    : "unplanned"

  const supabase = await createClient()

  // 3. Create the ride_series record
  const { data: series, error: seriesError } = await supabase
    .from("ride_series")
    .insert({
      patient_id: rideData.patient_id,
      destination_id: rideData.destination_id,
      recurrence_type: seriesData.recurrence_type,
      days_of_week:
        seriesData.days_of_week.length > 0
          ? seriesData.days_of_week
          : null,
      pickup_time: rideData.pickup_time,
      direction: rideData.direction,
      start_date: rideData.date,
      end_date: seriesData.end_date,
      notes: rideData.notes ?? null,
      appointment_time: rideData.appointment_time ?? null,
      appointment_end_time: rideData.appointment_end_time ?? null,
      return_pickup_time: rideData.return_pickup_time ?? null,
    })
    .select()
    .single()

  if (seriesError || !series) {
    return {
      success: false,
      error: seriesError?.message ?? "Fahrtserie konnte nicht erstellt werden",
    }
  }

  // 4. Calculate price fields for the initial ride (best-effort)
  let priceFields: {
    distance_meters?: number
    duration_seconds?: number
    calculated_price?: number
    fare_rule_id?: string
    price_override?: number | null
    price_override_reason?: string | null
  } = {}

  if (price_override != null) {
    priceFields.price_override = price_override
    priceFields.price_override_reason = price_override_reason ?? null
  }

  try {
    const [patientRes, destRes] = await Promise.all([
      supabase
        .from("patients")
        .select("postal_code, lat, lng, geocode_status")
        .eq("id", rideData.patient_id)
        .single(),
      supabase
        .from("destinations")
        .select("postal_code, lat, lng, geocode_status")
        .eq("id", rideData.destination_id)
        .single(),
    ])

    const patient = patientRes.data
    const dest = destRes.data

    if (
      patient?.postal_code &&
      dest?.postal_code &&
      patient.lat != null &&
      patient.lng != null &&
      dest.lat != null &&
      dest.lng != null
    ) {
      const { calculateRidePrice } = await import(
        "@/lib/billing/calculate-price"
      )
      const priceResult = await calculateRidePrice(
        patient.postal_code,
        dest.postal_code,
        { lat: patient.lat, lng: patient.lng },
        { lat: dest.lat, lng: dest.lng },
        rideData.date
      )

      if (priceResult) {
        priceFields = {
          ...priceFields,
          distance_meters: priceResult.distance_meters,
          duration_seconds: priceResult.duration_seconds,
          calculated_price: priceResult.calculated_price,
          fare_rule_id: priceResult.fare_rule_id,
        }
      }
    }
  } catch (err: unknown) {
    console.error(
      "Price calculation failed during createRideWithSeries:",
      err
    )
  }

  // 5. Create the initial ride
  const { data: initialRide, error: rideError } = await supabase
    .from("rides")
    .insert({
      ...rideData,
      ...priceFields,
      status,
      ride_series_id: series.id,
    })
    .select()
    .single()

  if (rideError) {
    return { success: false, error: rideError.message }
  }

  // 6. Optionally create return ride for the initial date
  if (create_return_ride && rideData.direction === "outbound") {
    const returnPickupTime =
      rideData.return_pickup_time ??
      (rideData.appointment_end_time
        ? addMinutesToTime(
            rideData.appointment_end_time,
            DEFAULT_RETURN_BUFFER_MINUTES
          )
        : null)

    if (returnPickupTime) {
      const { error: returnError } = await supabase.from("rides").insert({
        patient_id: rideData.patient_id,
        destination_id: rideData.destination_id,
        date: rideData.date,
        pickup_time: returnPickupTime,
        direction: "return" as const,
        status: "unplanned" as const,
        parent_ride_id: initialRide.id,
        ride_series_id: series.id,
      })

      if (returnError) {
        console.error(
          "Failed to create return ride for initial date:",
          returnError.message
        )
      }
    }
  }

  // 7. Generate additional rides for the series
  const defaultEndDate =
    seriesData.end_date ??
    new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0]!

  const allDates = generateDatesForSeries(
    {
      recurrence_type: seriesData.recurrence_type,
      days_of_week:
        seriesData.days_of_week.length > 0
          ? seriesData.days_of_week
          : null,
      start_date: rideData.date,
      end_date: seriesData.end_date,
    },
    rideData.date,
    defaultEndDate
  )

  // Skip the initial ride's date (already created above)
  const additionalDates = allDates.filter((d) => d !== rideData.date)

  for (const date of additionalDates) {
    if (rideData.direction === "both") {
      // Insert outbound first, then return with parent_ride_id
      const { data: outbound, error: outError } = await supabase
        .from("rides")
        .insert({
          patient_id: rideData.patient_id,
          destination_id: rideData.destination_id,
          ride_series_id: series.id,
          date,
          pickup_time: rideData.pickup_time,
          direction: "outbound",
          status: "unplanned",
          appointment_time: rideData.appointment_time ?? null,
          appointment_end_time: rideData.appointment_end_time ?? null,
        })
        .select("id")
        .single()

      if (!outError && outbound) {
        const returnPickup =
          rideData.return_pickup_time ?? rideData.pickup_time
        await supabase.from("rides").insert({
          patient_id: rideData.patient_id,
          destination_id: rideData.destination_id,
          ride_series_id: series.id,
          date,
          pickup_time: returnPickup,
          direction: "return",
          status: "unplanned",
          parent_ride_id: outbound.id,
          return_pickup_time: rideData.return_pickup_time ?? null,
        })
      }
    } else {
      // Single direction (outbound or return)
      const directions = expandDirections(rideData.direction)
      for (const dir of directions) {
        await supabase.from("rides").insert({
          patient_id: rideData.patient_id,
          destination_id: rideData.destination_id,
          ride_series_id: series.id,
          date,
          pickup_time:
            dir === "return" && rideData.return_pickup_time
              ? rideData.return_pickup_time
              : rideData.pickup_time,
          direction: dir,
          status: "unplanned",
          appointment_time:
            dir === "outbound"
              ? (rideData.appointment_time ?? null)
              : null,
          appointment_end_time:
            dir === "outbound"
              ? (rideData.appointment_end_time ?? null)
              : null,
        })
      }
    }
  }

  revalidatePath("/rides")
  revalidatePath("/ride-series")
  revalidatePath("/dispatch")
  redirect(`/rides?date=${rideData.date}`)
}

export async function updateRide(
  id: string,
  _prevState: ActionResult<Tables<"rides">> | null,
  formData: FormData
): Promise<ActionResult<Tables<"rides">>> {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const raw = Object.fromEntries(formData)
  const result = rideSchema.safeParse(raw)

  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    }
  }

  // Strip transient fields before DB update
  const {
    create_return_ride: _,
    price_override,
    price_override_reason,
    ...rideData
  } = result.data

  const supabase = await createClient()

  // Fetch current ride to check for auto-transition
  const { data: currentRide } = await supabase
    .from("rides")
    .select("status, driver_id")
    .eq("id", id)
    .single()

  if (!currentRide) {
    return { success: false, error: "Fahrt nicht gefunden" }
  }

  // Calculate price fields for update
  let priceFields: {
    distance_meters?: number | null
    duration_seconds?: number | null
    calculated_price?: number | null
    fare_rule_id?: string | null
    price_override?: number | null
    price_override_reason?: string | null
  } = {}

  // Include manual override (or clear it if not provided)
  priceFields.price_override = price_override ?? null
  priceFields.price_override_reason = price_override_reason ?? null

  // Attempt automatic price recalculation
  try {
    const [patientRes, destRes] = await Promise.all([
      supabase
        .from("patients")
        .select("postal_code, lat, lng, geocode_status")
        .eq("id", rideData.patient_id)
        .single(),
      supabase
        .from("destinations")
        .select("postal_code, lat, lng, geocode_status")
        .eq("id", rideData.destination_id)
        .single(),
    ])

    const patient = patientRes.data
    const dest = destRes.data

    if (
      patient?.postal_code &&
      dest?.postal_code &&
      patient.lat != null &&
      patient.lng != null &&
      dest.lat != null &&
      dest.lng != null
    ) {
      const { calculateRidePrice } = await import(
        "@/lib/billing/calculate-price"
      )
      const priceResult = await calculateRidePrice(
        patient.postal_code,
        dest.postal_code,
        { lat: patient.lat, lng: patient.lng },
        { lat: dest.lat, lng: dest.lng },
        rideData.date
      )

      if (priceResult) {
        priceFields = {
          ...priceFields,
          distance_meters: priceResult.distance_meters,
          duration_seconds: priceResult.duration_seconds,
          calculated_price: priceResult.calculated_price,
          fare_rule_id: priceResult.fare_rule_id,
        }
      }
    }
  } catch (err: unknown) {
    // Price calculation is best-effort; don't block ride update
    console.error("Price calculation failed during updateRide:", err)
  }

  // Auto-transition: unplanned -> planned when driver is newly assigned
  const updateData: Record<string, unknown> = {
    ...rideData,
    ...priceFields,
  }
  if (
    currentRide.status === "unplanned" &&
    !currentRide.driver_id &&
    rideData.driver_id
  ) {
    updateData.status = "planned"
  }

  const { data, error } = await supabase
    .from("rides")
    .update(updateData)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/rides")
  revalidatePath("/dispatch")
  redirect(`/rides?date=${rideData.date}`)
}

export async function updateRideStatus(
  rideId: string,
  newStatus: Enums<"ride_status">
): Promise<ActionResult> {
  const auth = await requireAuth()
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const supabase = await createClient()
  const { data: ride } = await supabase
    .from("rides")
    .select("status, driver_id")
    .eq("id", rideId)
    .single()

  if (!ride) {
    return { success: false, error: "Fahrt nicht gefunden" }
  }

  // Drivers can only update status on their own assigned rides
  if (auth.role === "driver" && ride.driver_id !== auth.driverId) {
    return { success: false, error: "Keine Berechtigung für diese Fahrt" }
  }

  try {
    assertTransitionForRole(ride.status, newStatus, auth.role)
  } catch {
    return { success: false, error: "Ungültiger Statusübergang" }
  }

  const { error } = await supabase
    .from("rides")
    .update({ status: newStatus })
    .eq("id", rideId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/rides")
  revalidatePath("/my/rides")
  return { success: true, data: undefined }
}

export async function assignDriver(
  rideId: string,
  driverId: string | null
): Promise<ActionResult> {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const supabase = await createClient()

  // Fetch current ride to check for auto-transition
  const { data: currentRide } = await supabase
    .from("rides")
    .select("status, driver_id")
    .eq("id", rideId)
    .single()

  if (!currentRide) {
    return { success: false, error: "Fahrt nicht gefunden" }
  }

  // Build update payload
  const updateData: {
    driver_id: string | null
    status?: Enums<"ride_status">
  } = {
    driver_id: driverId,
  }

  // Auto-transition: unplanned -> planned when driver is newly assigned
  if (
    currentRide.status === "unplanned" &&
    !currentRide.driver_id &&
    driverId
  ) {
    updateData.status = "planned"
  }

  // Auto-transition: planned -> unplanned when driver is removed
  if (
    currentRide.status === "planned" &&
    currentRide.driver_id &&
    !driverId
  ) {
    updateData.status = "unplanned"
  }

  const { error } = await supabase
    .from("rides")
    .update(updateData)
    .eq("id", rideId)

  if (error) {
    return { success: false, error: error.message }
  }

  // Fire-and-forget: send driver notification email when driver is assigned
  if (driverId && updateData.status === "planned") {
    invalidateTokensForRide(rideId)
      .then(() => sendDriverNotification(rideId, driverId))
      .catch(console.error)
  }

  revalidatePath("/dispatch")
  revalidatePath("/rides")
  revalidatePath("/my/rides")
  return { success: true, data: undefined }
}

/**
 * Calculate route distance and duration between a patient and a destination.
 * Used by the ride form to display route info before submission.
 */
export async function calculateRouteForRide(
  patientId: string,
  destinationId: string
): Promise<
  ActionResult<{ distance_meters: number; duration_seconds: number }>
> {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const supabase = await createClient()

  // Load patient and destination coordinates
  const [patientRes, destRes] = await Promise.all([
    supabase
      .from("patients")
      .select("lat, lng, geocode_status")
      .eq("id", patientId)
      .single(),
    supabase
      .from("destinations")
      .select("lat, lng, geocode_status")
      .eq("id", destinationId)
      .single(),
  ])

  if (!patientRes.data) {
    return { success: false, error: "Patient nicht gefunden" }
  }
  if (!destRes.data) {
    return { success: false, error: "Ziel nicht gefunden" }
  }

  const patient = patientRes.data
  const dest = destRes.data

  if (patient.lat == null || patient.lng == null) {
    return {
      success: false,
      error: "Patientenadresse hat keine Koordinaten. Geocoding-Status: " +
        patient.geocode_status,
    }
  }
  if (dest.lat == null || dest.lng == null) {
    return {
      success: false,
      error: "Zieladresse hat keine Koordinaten. Geocoding-Status: " +
        dest.geocode_status,
    }
  }

  try {
    const { getRoute } = await import("@/lib/maps/directions")
    const route = await getRoute(
      { lat: patient.lat, lng: patient.lng },
      { lat: dest.lat, lng: dest.lng }
    )

    return {
      success: true,
      data: {
        distance_meters: route.distance_meters,
        duration_seconds: route.duration_seconds,
      },
    }
  } catch (err: unknown) {
    console.error("Route calculation failed:", err)
    return { success: false, error: "Routenberechnung fehlgeschlagen" }
  }
}

export async function toggleRideActive(
  id: string,
  isActive: boolean
): Promise<ActionResult> {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("rides")
    .update({ is_active: isActive })
    .eq("id", id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/rides")
  return { success: true, data: undefined }
}
