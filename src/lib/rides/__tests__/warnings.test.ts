import { describe, it, expect } from "vitest"
import {
  collectRideWarnings,
  RIDE_WARNING_LABELS,
  type RideWarningInput,
} from "@/lib/rides/warnings"

const allResolved: RideWarningInput = {
  patientGeocoded: true,
  destinationGeocoded: true,
  priceResolved: true,
  appointmentTimeSet: true,
}

describe("collectRideWarnings", () => {
  it("returns no warnings when everything is resolved", () => {
    expect(collectRideWarnings(allResolved)).toEqual([])
  })

  it("warns when the patient is not geocoded", () => {
    const warnings = collectRideWarnings({
      ...allResolved,
      patientGeocoded: false,
    })
    expect(warnings).toEqual([
      {
        code: "patient_not_geocoded",
        field: "patient_id",
        message: RIDE_WARNING_LABELS.patient_not_geocoded,
      },
    ])
  })

  it("warns when the destination is not geocoded", () => {
    const warnings = collectRideWarnings({
      ...allResolved,
      destinationGeocoded: false,
    })
    expect(warnings.map((w) => w.code)).toEqual(["destination_not_geocoded"])
  })

  it("warns when the price could not be resolved", () => {
    const warnings = collectRideWarnings({
      ...allResolved,
      priceResolved: false,
    })
    expect(warnings.map((w) => w.code)).toEqual(["price_not_calculated"])
  })

  it("warns when the appointment time is missing", () => {
    const warnings = collectRideWarnings({
      ...allResolved,
      appointmentTimeSet: false,
    })
    expect(warnings.map((w) => w.code)).toEqual(["appointment_time_missing"])
  })

  it("emits all warnings in a stable order when nothing is resolved", () => {
    const warnings = collectRideWarnings({
      patientGeocoded: false,
      destinationGeocoded: false,
      priceResolved: false,
      appointmentTimeSet: false,
    })
    expect(warnings.map((w) => w.code)).toEqual([
      "patient_not_geocoded",
      "destination_not_geocoded",
      "price_not_calculated",
      "appointment_time_missing",
    ])
  })

  it("never throws and always returns an array (never blocks)", () => {
    expect(Array.isArray(collectRideWarnings(allResolved))).toBe(true)
  })
})
