/**
 * Ride persistence warnings (Issue #130).
 *
 * "Never block" principle: creating or updating a ride must never fail because
 * geocoding, route/price calculation or an appointment time is missing. Those
 * situations are surfaced as structured, non-blocking warnings instead of hard
 * field errors, so the dispatcher can save now and fix later. The capture UI
 * that renders these warnings is #139; this module only owns their shape and a
 * pure collector so it can be unit-tested in isolation (no DB/React/Next deps).
 */

import type { ActionWarning } from "@/actions/shared"

/** Stable, whitelisted warning codes for ride persistence. */
export type RideWarningCode =
  | "patient_not_geocoded"
  | "destination_not_geocoded"
  | "price_not_calculated"
  | "appointment_time_missing"

/** German fallback copy per warning code. */
export const RIDE_WARNING_LABELS: Record<RideWarningCode, string> = {
  patient_not_geocoded:
    "Die Patientenadresse ist noch nicht geocodiert. Route und Preis konnten nicht berechnet werden.",
  destination_not_geocoded:
    "Die Zieladresse ist noch nicht geocodiert. Route und Preis konnten nicht berechnet werden.",
  price_not_calculated:
    "Der Preis konnte nicht automatisch berechnet werden. Bitte spaeter pruefen oder manuell erfassen.",
  appointment_time_missing:
    "Es ist kein Terminbeginn erfasst. Abholzeit-Vorschlaege stehen daher nicht zur Verfuegung.",
}

/** Inputs describing what could (not) be resolved while persisting a ride. */
export interface RideWarningInput {
  /** Patient has usable lat/lng. */
  patientGeocoded: boolean
  /** Destination has usable lat/lng. */
  destinationGeocoded: boolean
  /** A price is present -- either auto-calculated or a manual override. */
  priceResolved: boolean
  /**
   * An appointment start time is set (or not applicable, e.g. return rides).
   * Callers pass `true` when the field does not apply to skip the warning.
   */
  appointmentTimeSet: boolean
}

/**
 * Derive the set of non-blocking warnings for a ride save. Pure and
 * order-stable: geocoding first, then price, then appointment.
 */
export function collectRideWarnings(input: RideWarningInput): ActionWarning[] {
  const warnings: ActionWarning[] = []

  if (!input.patientGeocoded) {
    warnings.push({
      code: "patient_not_geocoded",
      field: "patient_id",
      message: RIDE_WARNING_LABELS.patient_not_geocoded,
    })
  }

  if (!input.destinationGeocoded) {
    warnings.push({
      code: "destination_not_geocoded",
      field: "destination_id",
      message: RIDE_WARNING_LABELS.destination_not_geocoded,
    })
  }

  if (!input.priceResolved) {
    warnings.push({
      code: "price_not_calculated",
      message: RIDE_WARNING_LABELS.price_not_calculated,
    })
  }

  if (!input.appointmentTimeSet) {
    warnings.push({
      code: "appointment_time_missing",
      field: "appointment_time",
      message: RIDE_WARNING_LABELS.appointment_time_missing,
    })
  }

  return warnings
}
