"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/require-auth"
import {
  rideSchema,
  addMinutesToTime,
} from "@/lib/validations/rides"
import { loadRideTimeBuffers } from "@/lib/rides/time-buffers"
import { assertTransitionForRole } from "@/lib/rides/status-machine"
import { invalidateTokensForRide } from "@/lib/mail/tokens"
import { sendDriverNotification } from "@/lib/mail/send-driver-notification"
import { isAcceptanceFlowEnabled } from "@/lib/acceptance/constants"
import {
  createAcceptanceTracking,
  cancelAcceptanceTracking,
} from "@/lib/acceptance/engine"
import { recordAssignmentEvent } from "@/lib/acceptance/events"
import {
  generateDatesForSeries,
  expandDirections,
} from "@/lib/ride-series/generate"
import { logAudit } from "@/lib/audit/logger"
import {
  getDriverDayStatus,
  logOutsideAvailabilityAssignment,
} from "@/lib/availability/assignment"
import type { DriverDayStatus } from "@/lib/availability/driver-status"
import { trackEvent } from "@/lib/telemetry"
import { uuidSchema } from "@/lib/validations/shared"
import { collectRideWarnings } from "@/lib/rides/warnings"
import {
  planCoAssignment,
  resolveLinkedLegId,
  isCoAssignable,
  type CoAssignLegState,
  type LegRole,
} from "@/lib/rides/co-assign"
import type { ActionResult, ActionWarning } from "@/actions/shared"
import type { Tables, TablesInsert, Enums, Json } from "@/lib/types/database"
import type { RideRequirement } from "@/lib/rides/requirements"

/** Shown when a driver is assigned while on an approved absence (Issue #104). */
const DRIVER_ABSENT_ERROR =
  "Der gewaehlte Fahrer ist an diesem Datum abwesend (Ferien/Abwesenheit). Bitte einen anderen Fahrer waehlen."

// Issue #127: the pickup_* override columns exist in the DB (migration
// 20260721_000001) but are not in the generated types yet — they are
// regenerated centrally after the M13/M14 merge. Extend the insert payload
// locally so the columns are written type-safely (no `any`, no @ts-ignore).
// Remove this intersection once database.ts is regenerated.
type RidePickupOverrideFields = {
  pickup_location_text?: string | null
  pickup_lat?: number | null
  pickup_lng?: number | null
  pickup_place_id?: string | null
}
type RideInsertPayload = TablesInsert<"rides"> & RidePickupOverrideFields

/**
 * Parse ride form data through `rideSchema`.
 *
 * `requirements` is a multi-value field: `Object.fromEntries(formData)` keeps
 * only the last value for repeated keys, so it is pulled out explicitly via
 * `getAll` and merged back in before validation (Issue #126/#130).
 */
function parseRideForm(formData: FormData) {
  const raw = Object.fromEntries(formData)
  const requirements = formData.getAll("requirements").map(String)
  return rideSchema.safeParse({ ...raw, requirements })
}

/**
 * Ensure tariff/requirement consistency (Issue #130): a `companion` transport
 * requirement always implies a hospital escort, so `has_escort` is forced true
 * in that case. The mirror is intentionally one-directional to avoid double
 * bookkeeping -- an escort surcharge does not add a `companion` requirement.
 */
function resolveHasEscort(
  hasEscort: boolean,
  requirements: readonly RideRequirement[]
): boolean {
  return hasEscort || requirements.includes("companion")
}

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
    return createRideWithSeries(formData, auth.userId, auth.role)
  }

  const result = parseRideForm(formData)

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
    duration_category,
    is_tagesheim_imwil,
    has_escort,
    requirements,
    pickup_location_text,
    pickup_lat,
    pickup_lng,
    pickup_place_id,
    ...rideData
  } = result.data
  // A `companion` requirement always implies an escort (Issue #130).
  const effectiveHasEscort = resolveHasEscort(has_escort, requirements)
  const status: Enums<"ride_status"> = rideData.driver_id
    ? "planned"
    : "unplanned"

  // Pickup-location override (#127/#138). When both coordinates are present the
  // dispatcher captured a different pickup location; Route and price then start
  // there instead of the patient's home address. All null = unchanged behavior.
  const hasPickupOverride = pickup_lat != null && pickup_lng != null
  const pickupOverrideFields: RidePickupOverrideFields = {
    pickup_location_text,
    pickup_lat,
    pickup_lng,
    pickup_place_id,
  }

  const supabase = await createClient()

  // Non-blocking warning trackers (Issue #130): default to "not resolved" so a
  // thrown price/route calculation still yields correct warnings without ever
  // blocking the save. A manual override already counts as a resolved price.
  let patientGeocoded = false
  let destinationGeocoded = false
  let priceResolved = price_override != null

  // Availability / absence guard (Issue #104): block absent drivers, remember
  // whether the assignment lands outside the driver's availability window so we
  // can note it in the communication_log after a successful insert.
  let driverStatus: DriverDayStatus | null = null
  if (rideData.driver_id) {
    driverStatus = await getDriverDayStatus(
      supabase,
      rideData.driver_id,
      rideData.date,
      rideData.pickup_time
    )
    if (driverStatus.isAbsent) {
      return { success: false, error: DRIVER_ABSENT_ERROR }
    }
  }

  // Calculate price before insert (inline, not fire-and-forget)
  let priceFields: {
    distance_meters?: number | null
    duration_seconds?: number | null
    calculated_price?: number | null
    fare_rule_id?: string | null
    price_override?: number | null
    price_override_reason?: string | null
    tariff_zone?: string | null
    surcharge_amount?: number
    surcharge_details?: Json | null
    duration_category?: string
    is_tagesheim_imwil?: boolean
    has_escort?: boolean
    polyline?: string | null
  } = {
    duration_category,
    is_tagesheim_imwil,
    has_escort: effectiveHasEscort,
  }

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
        .select("postal_code, lat, lng, geocode_status, display_name")
        .eq("id", rideData.destination_id)
        .single(),
    ])

    const patient = patientRes.data
    const dest = destRes.data

    // Route/price origin: pickup override if set, else the patient's home.
    // Inline null-checks so TS narrows the coordinates (a const `boolean` would
    // not narrow pickup_lat/pickup_lng here).
    const originCoords: { lat: number; lng: number } | null =
      pickup_lat != null && pickup_lng != null
        ? { lat: pickup_lat, lng: pickup_lng }
        : patient?.lat != null && patient?.lng != null
          ? { lat: patient.lat, lng: patient.lng }
          : null

    // "Origin geocoded" for the non-blocking warning: an override always carries
    // coordinates, otherwise it reflects the patient's geocoding status.
    patientGeocoded = hasPickupOverride || originCoords != null
    destinationGeocoded = dest?.lat != null && dest?.lng != null

    if (
      originCoords &&
      dest?.postal_code &&
      dest.lat != null &&
      dest.lng != null &&
      (hasPickupOverride || patient?.postal_code != null)
    ) {
      const { calculateRidePrice, isPriceCalculationFailure } = await import(
        "@/lib/billing/calculate-price"
      )
      const priceResult = await calculateRidePrice({
        // patientPostalCode is not used by the tariff (zone is destination-based);
        // pass the patient's for completeness even when overriding the origin.
        patientPostalCode: patient?.postal_code ?? "",
        destinationPostalCode: dest.postal_code,
        patientCoords: originCoords,
        destinationCoords: { lat: dest.lat, lng: dest.lng },
        direction: rideData.direction,
        durationCategory: duration_category,
        destinationName: dest.display_name,
        hasEscort: effectiveHasEscort,
        isTagesheimImwilOverride: is_tagesheim_imwil,
      })

      if (isPriceCalculationFailure(priceResult)) {
        console.warn(
          "Preisberechnung übersprungen: Route für Ausserkantonal-Tarif nicht verfügbar."
        )
      } else {
        priceResolved = priceResolved || priceResult.calculated_price != null
        priceFields = {
          ...priceFields,
          distance_meters: priceResult.distance_meters,
          duration_seconds: priceResult.duration_seconds,
          calculated_price: priceResult.calculated_price,
          fare_rule_id: priceResult.fare_rule_id,
          tariff_zone: priceResult.tariff_zone,
          surcharge_amount: priceResult.surcharge_amount,
          surcharge_details: priceResult.breakdown.length > 0
            ? ({ items: priceResult.breakdown } as unknown as Json)
            : null,
          polyline: priceResult.polyline || null,
        }
      }
    }
  } catch (err: unknown) {
    // Price calculation is best-effort; don't block ride creation
    console.error("Price calculation failed during createRide:", err)
  }

  // 1. Create the outbound ride. The pickup_* override columns are cast via
  // RideInsertPayload until the generated types are regenerated (see top).
  const { data: outboundRide, error } = await supabase
    .from("rides")
    .insert({
      ...rideData,
      ...priceFields,
      ...pickupOverrideFields,
      requirements,
      status,
    } as RideInsertPayload)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Collect non-blocking persistence warnings (Issue #130). Missing geo/route/
  // price/appointment never blocks -- it is surfaced for the dispatcher instead.
  const warnings = collectRideWarnings({
    patientGeocoded,
    destinationGeocoded,
    priceResolved,
    appointmentTimeSet:
      rideData.direction === "return" || Boolean(rideData.appointment_time),
  })

  // Telemetry: track ride creation
  trackEvent({
    event: "ride_created",
    userId: auth.userId,
    properties: {
      status,
      direction: rideData.direction,
      has_driver: Boolean(rideData.driver_id),
      has_price: Boolean(priceFields.calculated_price),
      requirements_count: requirements.length,
      has_escort: effectiveHasEscort,
      warning_codes: warnings.map((w) => w.code),
    },
  })

  // Fire-and-forget audit log
  logAudit({
    userId: auth.userId,
    userRole: auth.role,
    action: "create",
    entityType: "ride",
    entityId: outboundRide.id,
    metadata: {
      status,
      direction: rideData.direction,
      requirements,
      has_escort: effectiveHasEscort,
      warning_codes: warnings.map((w) => w.code),
    },
  }).catch(() => {})

  // Note out-of-availability assignment in the communication_log (Issue #104)
  if (rideData.driver_id && driverStatus && !driverStatus.isWithinAvailability) {
    await logOutsideAvailabilityAssignment(supabase, {
      rideId: outboundRide.id,
      authorId: auth.userId,
      pickupTime: rideData.pickup_time,
      hasAvailability: driverStatus.hasAvailability,
    })
  }

  // 2. Optionally create return ride
  if (create_return_ride && rideData.direction === "outbound") {
    const { returnBufferMinutes } = await loadRideTimeBuffers(supabase)
    const returnPickupTime =
      rideData.return_pickup_time ??
      (rideData.appointment_end_time
        ? addMinutesToTime(
            rideData.appointment_end_time,
            returnBufferMinutes
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

  // Never-block: on warnings, return success + warnings so the form can surface
  // them (#139) instead of navigating away. The clean path redirects as before.
  // "+ Auftragsblatt" (#139): save_intent=order_sheet skips the redirect too,
  // so the capture form can open the M11 order sheet for the newly created ride.
  const skipRedirect =
    warnings.length > 0 || formData.get("save_intent") === "order_sheet"
  if (skipRedirect) {
    return { success: true, data: outboundRide, warnings }
  }
  redirect(`/rides?date=${rideData.date}`)
}

/**
 * Internal helper called from createRide when the series toggle is enabled.
 * Creates a ride_series record, the initial ride, and generates additional rides.
 */
async function createRideWithSeries(
  formData: FormData,
  authorId: string,
  authorRole: string
): Promise<ActionResult<Tables<"rides">>> {
  // 1. Validate ride data
  const rideResult = parseRideForm(formData)

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
    duration_category,
    is_tagesheim_imwil,
    has_escort,
    requirements,
    pickup_location_text,
    pickup_lat,
    pickup_lng,
    pickup_place_id,
    ...rideData
  } = rideResult.data
  const effectiveHasEscort = resolveHasEscort(has_escort, requirements)

  // Pickup-location override (#127/#138). Applied to the initial outbound ride
  // only — future series occurrences and the return leg keep the patient's home
  // address (NULL). See createRide for the semantics.
  const hasPickupOverride = pickup_lat != null && pickup_lng != null
  const pickupOverrideFields: RidePickupOverrideFields = {
    pickup_location_text,
    pickup_lat,
    pickup_lng,
    pickup_place_id,
  }

  const seriesData = seriesResult.data
  const status: Enums<"ride_status"> = rideData.driver_id
    ? "planned"
    : "unplanned"

  const supabase = await createClient()

  // Non-blocking warning trackers for the initial ride (Issue #130).
  let patientGeocoded = false
  let destinationGeocoded = false
  let priceResolved = price_override != null

  // Availability / absence guard for the initial ride's driver (Issue #104).
  let driverStatus: DriverDayStatus | null = null
  if (rideData.driver_id) {
    driverStatus = await getDriverDayStatus(
      supabase,
      rideData.driver_id,
      rideData.date,
      rideData.pickup_time
    )
    if (driverStatus.isAbsent) {
      return { success: false, error: DRIVER_ABSENT_ERROR }
    }
  }

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
    distance_meters?: number | null
    duration_seconds?: number | null
    calculated_price?: number | null
    fare_rule_id?: string | null
    price_override?: number | null
    price_override_reason?: string | null
    tariff_zone?: string | null
    surcharge_amount?: number
    surcharge_details?: Json | null
    duration_category?: string
    is_tagesheim_imwil?: boolean
    has_escort?: boolean
    polyline?: string | null
  } = {
    duration_category,
    is_tagesheim_imwil,
    has_escort: effectiveHasEscort,
  }

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
        .select("postal_code, lat, lng, geocode_status, display_name")
        .eq("id", rideData.destination_id)
        .single(),
    ])

    const patient = patientRes.data
    const dest = destRes.data

    // Route/price origin: pickup override if set, else the patient's home.
    // Inline null-checks so TS narrows the coordinates (a const `boolean` would
    // not narrow pickup_lat/pickup_lng here).
    const originCoords: { lat: number; lng: number } | null =
      pickup_lat != null && pickup_lng != null
        ? { lat: pickup_lat, lng: pickup_lng }
        : patient?.lat != null && patient?.lng != null
          ? { lat: patient.lat, lng: patient.lng }
          : null

    patientGeocoded = hasPickupOverride || originCoords != null
    destinationGeocoded = dest?.lat != null && dest?.lng != null

    if (
      originCoords &&
      dest?.postal_code &&
      dest.lat != null &&
      dest.lng != null &&
      (hasPickupOverride || patient?.postal_code != null)
    ) {
      const { calculateRidePrice, isPriceCalculationFailure } = await import(
        "@/lib/billing/calculate-price"
      )
      const priceResult = await calculateRidePrice({
        patientPostalCode: patient?.postal_code ?? "",
        destinationPostalCode: dest.postal_code,
        patientCoords: originCoords,
        destinationCoords: { lat: dest.lat, lng: dest.lng },
        direction: rideData.direction,
        durationCategory: duration_category,
        destinationName: dest.display_name,
        hasEscort: effectiveHasEscort,
        isTagesheimImwilOverride: is_tagesheim_imwil,
      })

      if (isPriceCalculationFailure(priceResult)) {
        console.warn(
          "Preisberechnung übersprungen: Route für Ausserkantonal-Tarif nicht verfügbar."
        )
      } else {
        priceResolved = priceResolved || priceResult.calculated_price != null
        priceFields = {
          ...priceFields,
          distance_meters: priceResult.distance_meters,
          duration_seconds: priceResult.duration_seconds,
          calculated_price: priceResult.calculated_price,
          fare_rule_id: priceResult.fare_rule_id,
          tariff_zone: priceResult.tariff_zone,
          surcharge_amount: priceResult.surcharge_amount,
          surcharge_details: priceResult.breakdown.length > 0
            ? ({ items: priceResult.breakdown } as unknown as Json)
            : null,
          polyline: priceResult.polyline || null,
        }
      }
    }
  } catch (err: unknown) {
    console.error(
      "Price calculation failed during createRideWithSeries:",
      err
    )
  }

  // 5. Create the initial ride (carries the pickup override; cast via
  // RideInsertPayload until the generated types are regenerated).
  const { data: initialRide, error: rideError } = await supabase
    .from("rides")
    .insert({
      ...rideData,
      ...priceFields,
      ...pickupOverrideFields,
      requirements,
      status,
      ride_series_id: series.id,
    } as RideInsertPayload)
    .select()
    .single()

  if (rideError) {
    return { success: false, error: rideError.message }
  }

  // Fire-and-forget audit + telemetry for the series' initial ride (Issue #130)
  const warnings = collectRideWarnings({
    patientGeocoded,
    destinationGeocoded,
    priceResolved,
    appointmentTimeSet:
      rideData.direction === "return" || Boolean(rideData.appointment_time),
  })

  trackEvent({
    event: "ride_created",
    userId: authorId,
    properties: {
      status,
      direction: rideData.direction,
      has_driver: Boolean(rideData.driver_id),
      has_price: Boolean(priceFields.calculated_price),
      requirements_count: requirements.length,
      has_escort: effectiveHasEscort,
      is_series: true,
      warning_codes: warnings.map((w) => w.code),
    },
  })

  logAudit({
    userId: authorId,
    userRole: authorRole,
    action: "create",
    entityType: "ride",
    entityId: initialRide.id,
    metadata: {
      status,
      direction: rideData.direction,
      requirements,
      has_escort: effectiveHasEscort,
      ride_series_id: series.id,
      warning_codes: warnings.map((w) => w.code),
    },
  }).catch(() => {})

  // Note out-of-availability assignment for the initial ride (Issue #104)
  if (rideData.driver_id && driverStatus && !driverStatus.isWithinAvailability) {
    await logOutsideAvailabilityAssignment(supabase, {
      rideId: initialRide.id,
      authorId,
      pickupTime: rideData.pickup_time,
      hasAvailability: driverStatus.hasAvailability,
    })
  }

  // 6. Optionally create return ride for the initial date
  if (create_return_ride && rideData.direction === "outbound") {
    const { returnBufferMinutes } = await loadRideTimeBuffers(supabase)
    const returnPickupTime =
      rideData.return_pickup_time ??
      (rideData.appointment_end_time
        ? addMinutesToTime(
            rideData.appointment_end_time,
            returnBufferMinutes
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
        requirements,
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
          requirements,
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
          requirements,
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
          requirements,
        })
      }
    }
  }

  revalidatePath("/rides")
  revalidatePath("/ride-series")
  revalidatePath("/dispatch")

  // Never-block: surface warnings from the initial ride instead of redirecting.
  // "+ Auftragsblatt" (#139): skip the redirect on save_intent=order_sheet as in
  // createRide, so the order sheet can be opened for the series' initial ride.
  const skipRedirect =
    warnings.length > 0 || formData.get("save_intent") === "order_sheet"
  if (skipRedirect) {
    return { success: true, data: initialRide, warnings }
  }
  redirect(`/rides?date=${rideData.date}`)
}

export async function updateRide(
  id: string,
  _prevState: ActionResult<Tables<"rides">> | null,
  formData: FormData
): Promise<ActionResult<Tables<"rides">>> {
  uuidSchema.parse(id)

  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const result = parseRideForm(formData)

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
    duration_category,
    is_tagesheim_imwil,
    has_escort,
    requirements,
    ...rideData
  } = result.data
  const effectiveHasEscort = resolveHasEscort(has_escort, requirements)

  const supabase = await createClient()

  // Non-blocking warning trackers (Issue #130).
  let patientGeocoded = false
  let destinationGeocoded = false
  let priceResolved = price_override != null

  // Fetch current ride to check for auto-transition
  const { data: currentRide } = await supabase
    .from("rides")
    .select("status, driver_id, date, pickup_time")
    .eq("id", id)
    .single()

  if (!currentRide) {
    return { success: false, error: "Fahrt nicht gefunden" }
  }

  // Availability / absence guard (Issue #104). Only (re)check when the driver
  // is set and something relevant changed -- a new driver, or the ride moved
  // to another date/time -- so unrelated edits of existing rides never break.
  let driverStatus: DriverDayStatus | null = null
  if (rideData.driver_id) {
    const driverChanged = rideData.driver_id !== currentRide.driver_id
    const scheduleChanged =
      rideData.date !== currentRide.date ||
      rideData.pickup_time !== currentRide.pickup_time
    if (driverChanged || scheduleChanged) {
      driverStatus = await getDriverDayStatus(
        supabase,
        rideData.driver_id,
        rideData.date,
        rideData.pickup_time
      )
      if (driverStatus.isAbsent) {
        return { success: false, error: DRIVER_ABSENT_ERROR }
      }
    }
  }

  // Calculate price fields for update
  let priceFields: {
    distance_meters?: number | null
    duration_seconds?: number | null
    calculated_price?: number | null
    fare_rule_id?: string | null
    price_override?: number | null
    price_override_reason?: string | null
    tariff_zone?: string | null
    surcharge_amount?: number
    surcharge_details?: Json | null
    duration_category?: string
    is_tagesheim_imwil?: boolean
    has_escort?: boolean
    polyline?: string | null
  } = {
    duration_category,
    is_tagesheim_imwil,
    has_escort: effectiveHasEscort,
  }

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
        .select("postal_code, lat, lng, geocode_status, display_name")
        .eq("id", rideData.destination_id)
        .single(),
    ])

    const patient = patientRes.data
    const dest = destRes.data

    patientGeocoded = patient?.lat != null && patient?.lng != null
    destinationGeocoded = dest?.lat != null && dest?.lng != null

    if (
      patient?.postal_code &&
      dest?.postal_code &&
      patient.lat != null &&
      patient.lng != null &&
      dest.lat != null &&
      dest.lng != null
    ) {
      const { calculateRidePrice, isPriceCalculationFailure } = await import(
        "@/lib/billing/calculate-price"
      )
      const priceResult = await calculateRidePrice({
        patientPostalCode: patient.postal_code,
        destinationPostalCode: dest.postal_code,
        patientCoords: { lat: patient.lat, lng: patient.lng },
        destinationCoords: { lat: dest.lat, lng: dest.lng },
        direction: rideData.direction,
        durationCategory: duration_category,
        destinationName: dest.display_name,
        hasEscort: effectiveHasEscort,
        isTagesheimImwilOverride: is_tagesheim_imwil,
      })

      if (isPriceCalculationFailure(priceResult)) {
        console.warn(
          "Preisberechnung übersprungen: Route für Ausserkantonal-Tarif nicht verfügbar."
        )
      } else {
        priceResolved = priceResolved || priceResult.calculated_price != null
        priceFields = {
          ...priceFields,
          distance_meters: priceResult.distance_meters,
          duration_seconds: priceResult.duration_seconds,
          calculated_price: priceResult.calculated_price,
          fare_rule_id: priceResult.fare_rule_id,
          tariff_zone: priceResult.tariff_zone,
          surcharge_amount: priceResult.surcharge_amount,
          surcharge_details: priceResult.breakdown.length > 0
            ? ({ items: priceResult.breakdown } as unknown as Json)
            : null,
          polyline: priceResult.polyline || null,
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
    requirements,
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

  // Collect non-blocking persistence warnings (Issue #130).
  const warnings = collectRideWarnings({
    patientGeocoded,
    destinationGeocoded,
    priceResolved,
    appointmentTimeSet:
      rideData.direction === "return" || Boolean(rideData.appointment_time),
  })

  // Fire-and-forget audit log
  logAudit({
    userId: auth.userId,
    userRole: auth.role,
    action: "update",
    entityType: "ride",
    entityId: id,
    metadata: {
      fields: [...Object.keys(rideData), "requirements"],
      requirements,
      has_escort: effectiveHasEscort,
      warning_codes: warnings.map((w) => w.code),
    },
  }).catch(() => {})

  // Telemetry: track ride update (Issue #130)
  trackEvent({
    event: "ride_updated",
    userId: auth.userId,
    properties: {
      has_price: Boolean(priceFields.calculated_price),
      requirements_count: requirements.length,
      has_escort: effectiveHasEscort,
      warning_codes: warnings.map((w) => w.code),
    },
  })

  // Note out-of-availability assignment in the communication_log (Issue #104)
  if (rideData.driver_id && driverStatus && !driverStatus.isWithinAvailability) {
    await logOutsideAvailabilityAssignment(supabase, {
      rideId: id,
      authorId: auth.userId,
      pickupTime: rideData.pickup_time,
      hasAvailability: driverStatus.hasAvailability,
    })
  }

  revalidatePath("/rides")
  revalidatePath("/dispatch")

  // Never-block: surface warnings instead of redirecting when present.
  if (warnings.length > 0) {
    return { success: true, data, warnings }
  }
  redirect(`/rides?date=${rideData.date}`)
}

export async function updateRideStatus(
  rideId: string,
  newStatus: Enums<"ride_status">
): Promise<ActionResult> {
  uuidSchema.parse(rideId)

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

  // Fire-and-forget audit log
  logAudit({
    userId: auth.userId,
    userRole: auth.role,
    action: "status_change",
    entityType: "ride",
    entityId: rideId,
    changes: { status: { old: ride.status, new: newStatus } },
  }).catch(() => {})

  revalidatePath("/rides")
  revalidatePath("/my/rides")
  return { success: true, data: undefined }
}

export async function assignDriver(
  rideId: string,
  driverId: string | null
): Promise<ActionResult> {
  uuidSchema.parse(rideId)
  if (driverId !== null) uuidSchema.parse(driverId)

  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const supabase = await createClient()

  // Fetch current ride to check for auto-transition
  const { data: currentRide } = await supabase
    .from("rides")
    .select("status, driver_id, date, pickup_time")
    .eq("id", rideId)
    .single()

  if (!currentRide) {
    return { success: false, error: "Fahrt nicht gefunden" }
  }

  // Availability / absence guard (Issue #104): only when a *new* driver is
  // being assigned. Block absent drivers; remember out-of-availability so we
  // can note it in the communication_log after a successful update.
  let driverStatus: DriverDayStatus | null = null
  if (driverId && driverId !== currentRide.driver_id) {
    driverStatus = await getDriverDayStatus(
      supabase,
      driverId,
      currentRide.date,
      currentRide.pickup_time
    )
    if (driverStatus.isAbsent) {
      return { success: false, error: DRIVER_ABSENT_ERROR }
    }
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

  const driverChanged = driverId !== currentRide.driver_id
  const newStatus = updateData.status ?? currentRide.status

  // Manipulation-safe audit trail for every assignment/removal (finding #181):
  // assignDriver previously wrote no audit_log entry. "assign" when a driver is
  // set, "reassign" when a driver is removed or replaced.
  if (driverChanged) {
    logAudit({
      userId: auth.userId,
      userRole: auth.role,
      action: driverId ? "assign" : "reassign",
      entityType: "ride",
      entityId: rideId,
      changes: {
        driver_id: { old: currentRide.driver_id, new: driverId },
        status: { old: currentRide.status, new: newStatus },
      },
    }).catch(() => {})
  }

  // Note out-of-availability assignment in the communication_log (Issue #104)
  if (driverId && driverStatus && !driverStatus.isWithinAvailability) {
    await logOutsideAvailabilityAssignment(supabase, {
      rideId,
      authorId: auth.userId,
      pickupTime: currentRide.pickup_time,
      hasAvailability: driverStatus.hasAvailability,
    })
  }

  // SEC-M9-013: Await token invalidation (not fire-and-forget)
  if (driverId && updateData.status === "planned") {
    await invalidateTokensForRide(rideId)

    // Fire-and-forget: send driver notification email
    sendDriverNotification(rideId, driverId).catch(console.error)

    // Append to the per-ride status history (assignment_events, Issue #164):
    // dispatcher requested this driver. actor is derived server-side (#185).
    await recordAssignmentEvent({
      rideId,
      driverId,
      event: "requested",
      actor: "dispatcher",
    })

    // Create acceptance tracking if feature is enabled
    if (isAcceptanceFlowEnabled()) {
      // Fetch ride date and pickup_time for short-notice detection
      const { data: rideForTracking } = await supabase
        .from("rides")
        .select("date, pickup_time")
        .eq("id", rideId)
        .single()

      if (rideForTracking) {
        await createAcceptanceTracking(
          rideId,
          driverId,
          rideForTracking.date,
          rideForTracking.pickup_time
        )
      }
    }
  }

  // Cancel acceptance tracking when driver is removed
  if (!driverId && currentRide.driver_id) {
    await invalidateTokensForRide(rideId)
    if (isAcceptanceFlowEnabled()) {
      await cancelAcceptanceTracking(rideId)
    }

    // Append to the per-ride status history (assignment_events, Issue #164):
    // dispatcher removed the driver, ride returns to the pool for reassignment.
    await recordAssignmentEvent({
      rideId,
      driverId: currentRide.driver_id,
      event: "reassigned",
      actor: "dispatcher",
    })
  }

  revalidatePath("/dispatch")
  revalidatePath("/rides")
  revalidatePath("/my/rides")
  return { success: true, data: undefined }
}

/** Columns needed to plan + apply a co-assignment for one leg. */
interface CoAssignLegRow {
  id: string
  status: Enums<"ride_status">
  driver_id: string | null
  date: string
  pickup_time: string
  parent_ride_id: string | null
}

const CO_ASSIGN_LEG_COLUMNS =
  "id, status, driver_id, date, pickup_time, parent_ride_id"

/** Result of {@link assignDriverWithReturn}: which legs actually got assigned. */
export interface AssignWithReturnResult {
  /** Ride ids that were (re)assigned to the driver in this operation. */
  assignedRideIds: string[]
  /** Whether the linked return leg was co-assigned. */
  returnLegAssigned: boolean
  /**
   * Set when `includeReturn` was requested but the linked leg was skipped
   * because it is in a non-assignable status (terminal / already underway).
   */
  returnLegSkippedReason?: "not_assignable" | "no_linked_leg"
}

/**
 * Assign a driver to a ride and, on request, to its linked return leg in one
 * atomic action (Issue #167, concept §2.1/§2.3).
 *
 * The link is `rides.parent_ride_id` (self-FK, return → outbound); the linked
 * leg is resolved in both directions. Security rule #182: the absence/conflict
 * guard runs for *every* leg before anything is written — if any leg fails hard
 * (driver absent), nothing is assigned and a speaking error is returned. If a
 * DB write fails mid-way, already-applied legs are rolled back.
 *
 * Mail variant (documented per issue): MVP = one separate request mail + one
 * token + one `acceptance_tracking` per leg. A single bundled double-token mail
 * is a possible follow-up.
 *
 * `driverId` must be non-null — this action only assigns. Driver removal keeps
 * going through {@link assignDriver}.
 */
export async function assignDriverWithReturn(
  rideId: string,
  driverId: string,
  options: { includeReturn: boolean }
): Promise<ActionResult<AssignWithReturnResult>> {
  uuidSchema.parse(rideId)
  uuidSchema.parse(driverId)

  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const supabase = await createClient()

  // 1) Load the primary leg the dispatcher explicitly picked.
  const { data: primaryRow } = await supabase
    .from("rides")
    .select(CO_ASSIGN_LEG_COLUMNS)
    .eq("id", rideId)
    .single<CoAssignLegRow>()

  if (!primaryRow) {
    return { success: false, error: "Fahrt nicht gefunden" }
  }

  // 2) Resolve the linked return leg (both directions) when requested.
  let linkedRow: CoAssignLegRow | null = null
  let skippedReason: AssignWithReturnResult["returnLegSkippedReason"]

  if (options.includeReturn) {
    let linkedId = resolveLinkedLegId(primaryRow, null)

    // Outbound leg: the linked return leg points back at us via parent_ride_id.
    if (!linkedId) {
      const { data: childRow } = await supabase
        .from("rides")
        .select("id")
        .eq("parent_ride_id", rideId)
        .maybeSingle()
      linkedId = childRow?.id ?? null
    }

    if (!linkedId) {
      skippedReason = "no_linked_leg"
    } else {
      const { data: fetchedLinked } = await supabase
        .from("rides")
        .select(CO_ASSIGN_LEG_COLUMNS)
        .eq("id", linkedId)
        .single<CoAssignLegRow>()

      if (fetchedLinked && isCoAssignable(fetchedLinked.status)) {
        linkedRow = fetchedLinked
      } else {
        // Linked leg exists but is terminal / already underway — never clobber
        // it. The primary assignment still proceeds.
        skippedReason = "not_assignable"
      }
    }
  }

  // 3) Build the leg list and compute the absence/conflict guard for EACH leg
  //    (security #182) BEFORE mutating anything.
  const legRows: Array<{ row: CoAssignLegRow; role: LegRole }> = [
    { row: primaryRow, role: "primary" },
  ]
  if (linkedRow) legRows.push({ row: linkedRow, role: "return" })

  const guardByRide = new Map<string, DriverDayStatus | null>()
  const legStates: CoAssignLegState[] = []

  for (const { row, role } of legRows) {
    let driverStatus: DriverDayStatus | null = null
    // Only guard when a *different* driver is being assigned (matches the
    // single-assign flow — reassigning the same driver skips the check).
    if (driverId !== row.driver_id) {
      driverStatus = await getDriverDayStatus(
        supabase,
        driverId,
        row.date,
        row.pickup_time
      )
    }
    guardByRide.set(row.id, driverStatus)
    legStates.push({
      rideId: row.id,
      role,
      status: row.status,
      currentDriverId: row.driver_id,
      isAbsent: driverStatus?.isAbsent ?? false,
    })
  }

  // 4) Atomic go/no-go. Aborts (nothing assigned) if any leg's driver is absent.
  const plan = planCoAssignment(legStates, driverId)
  if (!plan.proceed) {
    return { success: false, error: plan.error }
  }

  // 5) Apply the DB updates. Collect enough to roll back if a later write fails.
  const applied: Array<{
    rideId: string
    prevDriverId: string | null
    prevStatus: Enums<"ride_status">
  }> = []

  for (const leg of plan.legs) {
    const source = legRows.find((l) => l.row.id === leg.rideId)
    if (!source) continue

    const updateData: {
      driver_id: string
      status?: Enums<"ride_status">
    } = { driver_id: driverId }
    if (leg.statusChanged) updateData.status = leg.targetStatus

    const { error } = await supabase
      .from("rides")
      .update(updateData)
      .eq("id", leg.rideId)

    if (error) {
      // Roll back everything applied so far so the operation stays all-or-none.
      await rollbackAppliedLegs(supabase, applied)
      return {
        success: false,
        error: `Zuweisung fehlgeschlagen: ${error.message}`,
      }
    }

    applied.push({
      rideId: leg.rideId,
      prevDriverId: source.row.driver_id,
      prevStatus: source.row.status,
    })
  }

  // 6) All writes succeeded — run per-leg side effects (audit, out-of-avail
  //    note, token invalidation, acceptance tracking, request mail, events).
  const acceptanceEnabled = isAcceptanceFlowEnabled()
  const assignedRideIds: string[] = []

  for (const leg of plan.legs) {
    const source = legRows.find((l) => l.row.id === leg.rideId)
    if (!source) continue
    const row = source.row
    assignedRideIds.push(leg.rideId)

    // Manipulation-safe audit trail for every assignment (#181).
    if (leg.driverChanged) {
      logAudit({
        userId: auth.userId,
        userRole: auth.role,
        action: "assign",
        entityType: "ride",
        entityId: leg.rideId,
        changes: {
          driver_id: { old: row.driver_id, new: driverId },
          status: { old: row.status, new: leg.targetStatus },
        },
        metadata: { co_assign: true, leg: leg.role },
      }).catch(() => {})
    }

    // Note out-of-availability assignment in the communication_log (#104).
    const guard = guardByRide.get(leg.rideId)
    if (guard && !guard.isWithinAvailability) {
      await logOutsideAvailabilityAssignment(supabase, {
        rideId: leg.rideId,
        authorId: auth.userId,
        pickupTime: row.pickup_time,
        hasAvailability: guard.hasAvailability,
      })
    }

    // A fresh acceptance request is needed for this leg.
    if (leg.requestAcceptance) {
      await invalidateTokensForRide(leg.rideId)

      // Fire-and-forget: send this leg's driver request email (one per leg).
      sendDriverNotification(leg.rideId, driverId).catch(console.error)

      // Per-ride status history (#164): dispatcher requested this driver.
      await recordAssignmentEvent({
        rideId: leg.rideId,
        driverId,
        event: "requested",
        actor: "dispatcher",
        detail: leg.role === "return" ? "return_leg" : null,
      })

      if (acceptanceEnabled) {
        await createAcceptanceTracking(
          leg.rideId,
          driverId,
          row.date,
          row.pickup_time
        )
      }
    }
  }

  revalidatePath("/dispatch")
  revalidatePath("/rides")
  revalidatePath("/my/rides")

  return {
    success: true,
    data: {
      assignedRideIds,
      returnLegAssigned: plan.legs.some((l) => l.role === "return"),
      ...(skippedReason ? { returnLegSkippedReason: skippedReason } : {}),
    },
  }
}

/**
 * Revert `driver_id`/`status` for legs already updated in a co-assignment when a
 * later leg's write fails, keeping the operation all-or-none (#182). Best-effort:
 * logs but never throws so the caller can still surface the original error.
 */
async function rollbackAppliedLegs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  applied: Array<{
    rideId: string
    prevDriverId: string | null
    prevStatus: Enums<"ride_status">
  }>
): Promise<void> {
  for (const leg of applied) {
    const { error } = await supabase
      .from("rides")
      .update({ driver_id: leg.prevDriverId, status: leg.prevStatus })
      .eq("id", leg.rideId)
    if (error) {
      console.error(
        `[co-assign] Rollback failed for ride ${leg.rideId}:`,
        error.message
      )
    }
  }
}

/**
 * Calculate route distance and duration between a patient and a destination.
 * Used by the ride form to display route info before submission.
 *
 * `pickupOverride` (#138): when the dispatcher captured a different pickup
 * location, its geocoded coordinates are used as the route origin instead of
 * the patient's home address. Omitted/null = unchanged behavior (patient home).
 */
export async function calculateRouteForRide(
  patientId: string,
  destinationId: string,
  pickupOverride?: { lat: number; lng: number } | null
): Promise<

  ActionResult<{
    distance_meters: number
    duration_seconds: number
    origin_lat: number
    origin_lng: number
    dest_lat: number
    dest_lng: number
    polyline: string
  }>
> {
  uuidSchema.parse(patientId)
  uuidSchema.parse(destinationId)

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

  // Origin = pickup override (already geocoded on the client) or patient home.
  const origin: { lat: number; lng: number } | null =
    pickupOverride != null
      ? { lat: pickupOverride.lat, lng: pickupOverride.lng }
      : patient.lat != null && patient.lng != null
        ? { lat: patient.lat, lng: patient.lng }
        : null

  if (!origin) {
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
    const route = await getRoute(origin, { lat: dest.lat, lng: dest.lng })

    return {
      success: true,
      data: {
        distance_meters: route.distance_meters,
        duration_seconds: route.duration_seconds,
        origin_lat: origin.lat,
        origin_lng: origin.lng,
        dest_lat: dest.lat,
        dest_lng: dest.lng,
        polyline: route.polyline ?? "",
      },
    }
  } catch (err: unknown) {
    console.error("Route calculation failed:", err)
    return { success: false, error: "Routenberechnung fehlgeschlagen" }
  }
}

/**
 * Geocode a free-text pickup-location override (#138).
 *
 * Marco's cost constraint: this runs ONLY when the dispatcher actually enters a
 * different pickup location (on blur / on confirm — never per keystroke), and
 * the caller caches the result so the same text is not geocoded twice. Routed
 * through the central server-key Maps wrapper (`geocodeText`); no direct fetch.
 */
export async function geocodePickupLocation(
  query: string
): Promise<
  ActionResult<{
    lat: number
    lng: number
    place_id: string
    formatted_address: string
  }>
> {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const trimmed = query.trim()
  if (trimmed.length < 3) {
    return {
      success: false,
      error: "Bitte geben Sie eine vollständige Adresse ein.",
    }
  }

  try {
    const { geocodeText } = await import("@/lib/maps/geocode")
    const result = await geocodeText(trimmed)
    if (!result) {
      return {
        success: false,
        error: "Adresse konnte nicht gefunden werden. Bitte prüfen.",
      }
    }
    return { success: true, data: result }
  } catch (err: unknown) {
    console.error("Pickup geocoding failed:", err)
    return { success: false, error: "Geocoding fehlgeschlagen." }
  }
}

export async function toggleRideActive(
  id: string,
  isActive: boolean
): Promise<ActionResult> {
  uuidSchema.parse(id)

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

  // Fire-and-forget audit log
  logAudit({
    userId: auth.userId,
    userRole: auth.role,
    action: isActive ? "activate" : "deactivate",
    entityType: "ride",
    entityId: id,
    changes: { is_active: { old: !isActive, new: isActive } },
  }).catch(() => {})

  revalidatePath("/rides")
  return { success: true, data: undefined }
}

// ---------------------------------------------------------------------------
// Ride Quick Details (for dispatch quick sheet)
// ---------------------------------------------------------------------------

export interface RideQuickDetails {
  id: string
  date: string
  pickup_time: string
  appointment_time: string | null
  status: Enums<"ride_status">
  direction: Enums<"ride_direction">
  notes: string | null
  patient: {
    first_name: string
    last_name: string
    street: string | null
    house_number: string | null
    postal_code: string | null
    city: string | null
  } | null
  destination: {
    display_name: string
    street: string | null
    house_number: string | null
    postal_code: string | null
    city: string | null
  } | null
  driver: {
    first_name: string
    last_name: string
  } | null
  impairments: Enums<"impairment_type">[]
}

/**
 * Load quick-view details for a single ride (dispatch sheet).
 * Returns only the fields needed for the side panel.
 */
export async function getRideQuickDetails(
  rideId: string
): Promise<ActionResult<RideQuickDetails>> {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: "Nicht autorisiert" }
  }

  const parsed = uuidSchema.safeParse(rideId)
  if (!parsed.success) {
    return { success: false, error: "Ungueltige Fahrt-ID" }
  }

  const supabase = await createClient()

  // Fetch ride with patient, destination, driver
  const { data: ride, error } = await supabase
    .from("rides")
    .select("id, date, pickup_time, appointment_time, status, direction, notes, patient_id, patients(first_name, last_name, street, house_number, postal_code, city), destinations(display_name, street, house_number, postal_code, city), drivers(first_name, last_name)")
    .eq("id", parsed.data)
    .single()

  if (error || !ride) {
    return { success: false, error: error?.message ?? "Fahrt nicht gefunden" }
  }

  // Fetch patient impairments
  const { data: impairmentRows } = await supabase
    .from("patient_impairments")
    .select("impairment_type")
    .eq("patient_id", ride.patient_id)

  const patient = ride.patients as RideQuickDetails["patient"]
  const destination = ride.destinations as RideQuickDetails["destination"]
  const driver = ride.drivers as RideQuickDetails["driver"]
  const impairments = (impairmentRows ?? []).map(
    (r) => r.impairment_type as Enums<"impairment_type">
  )

  return {
    success: true,
    data: {
      id: ride.id,
      date: ride.date,
      pickup_time: ride.pickup_time,
      appointment_time: ride.appointment_time,
      status: ride.status,
      direction: ride.direction,
      notes: ride.notes,
      patient,
      destination,
      driver,
      impairments,
    },
  }
}
