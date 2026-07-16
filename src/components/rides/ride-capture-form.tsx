"use client"

/**
 * RideCaptureForm — the core of the "Fahrt erfassen" one-page dispo (Issue #131).
 *
 * Mirrors the dispatch phone call as a two-column layout:
 *   LEFT  = capture, in narrative order  WER → WOHIN & WANN → FAHRT
 *   RIGHT = a permanently visible live result panel (map, pickup time(s), price,
 *           warnings), sticky on desktop, stacked below on mobile.
 *
 * This component owns ALL state and composes slot components (#132–#137) that
 * later agents fill in — it deliberately does NOT extend the edit-flow
 * `ride-form.tsx`. The core fields built here are: appointment (date/time),
 * appointment duration, the trip-type toggle (Hin / Hin+Rück) and the
 * overridable pickup time(s) with a live suggestion via `calculateRideTimes`.
 *
 * Persistence goes through the existing `createRide` server action (#130):
 *   - "Speichern & zur Übersicht" (save_intent=list) redirects to the day view
 *     on the clean path; if warnings exist it returns them and we show the
 *     post-save panel instead of navigating away.
 *   - "+ Auftragsblatt" (save_intent=order_sheet) always skips the redirect so
 *     we can hand the new ride id to the M11 order sheet (/api/mail/preview).
 * The full "never block" warning UX (informative, non-alarming, save always
 * possible) and the order-sheet hand-off are Issue #139.
 */

import {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useTransition,
  type FormEvent,
} from "react"
import { useFormState } from "react-dom"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { createRide, calculateRouteForRide } from "@/actions/rides"
import { calculateRideTimes } from "@/lib/rides/time-calc"
import { addMinutesToTime } from "@/lib/validations/rides"
import type { RideTimeBuffers } from "@/lib/rides/time-buffers"
import type { RideRequirement } from "@/lib/rides/requirements"
import type { ActionResult } from "@/actions/shared"
import type { Tables } from "@/lib/types/database"

import { CapturePatientField } from "./capture/capture-patient-field"
import { CaptureDestinationField } from "./capture/capture-destination-field"
import { CostBearerDisplay } from "./capture/cost-bearer-display"
import { PickupOverrideField } from "./capture/pickup-override-field"
import { RequirementChips } from "./capture/requirement-chips"
import { SeriesToggle } from "./capture/series-toggle"
import { RideMapPanel } from "./capture/ride-map-panel"
import { RidePricePanel } from "./capture/ride-price-panel"
import { CaptureSaveActions } from "./capture/capture-save-actions"
import { SaveResultPanel } from "./capture/save-result-panel"
import type {
  CapturePatient,
  CaptureDestination,
  RideType,
  RouteInfo,
  DurationCategory,
  PickupOverride,
} from "./capture/types"

export interface RideCaptureFormProps {
  patients: CapturePatient[]
  destinations: CaptureDestination[]
  /** Org-wide time buffers so the client preview matches the server suggestion. */
  timeBuffers: RideTimeBuffers
  defaultDate?: string
  defaultPatientId?: string
  defaultDestinationId?: string
}

/** Appointment-duration threshold (minutes) at which the tariff bucket flips. */
const OVER_2H_THRESHOLD_MINUTES = 120

/** Quick-pick presets for the appointment duration (minutes). */
const DURATION_PRESETS = [30, 45, 60, 90, 120, 180] as const

function SectionHeader({ step, title }: { step: number; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
        aria-hidden="true"
      >
        {step}
      </span>
      <CardTitle className="text-base">{title}</CardTitle>
    </div>
  )
}

export function RideCaptureForm({
  patients,
  destinations,
  timeBuffers,
  defaultDate,
  defaultPatientId,
  defaultDestinationId,
}: RideCaptureFormProps) {
  const [state, formAction] = useFormState<
    ActionResult<Tables<"rides">> | null,
    FormData
  >(createRide, null)
  const fieldErrors = state && !state.success ? state.fieldErrors : undefined

  // Post-save state (#139): createRide returned success without redirecting
  // (warnings present or "+ Auftragsblatt"). We then show the SaveResultPanel
  // and hide the save actions so the ride cannot be submitted twice.
  const saved = state?.success === true
  const savedRide = state?.success ? state.data : null
  const saveWarnings = state?.success ? (state.warnings ?? []) : []

  // --- Lists (stateful so #134 can append inline-created entities) ---
  const [patientList, setPatientList] = useState(patients)
  const [destinationList, setDestinationList] = useState(destinations)

  // --- WER ---
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(
    defaultPatientId ?? null
  )

  // --- Pickup-location override (#138). null = patient home address (default). ---
  const [pickupOverride, setPickupOverride] = useState<PickupOverride | null>(
    null
  )

  // --- WOHIN & WANN ---
  const [selectedDestinationId, setSelectedDestinationId] = useState<
    string | null
  >(defaultDestinationId ?? null)
  const [date, setDate] = useState<string>(defaultDate ?? "")
  const [appointmentTime, setAppointmentTime] = useState<string>("")
  const [appointmentDuration, setAppointmentDuration] = useState<string>("")
  const [requirements, setRequirements] = useState<RideRequirement[]>([])

  // --- FAHRT ---
  const [rideType, setRideType] = useState<RideType>("round_trip")

  // --- Overridable pickup times ---
  const [pickupTime, setPickupTime] = useState<string>("")
  const [pickupManual, setPickupManual] = useState(false)
  const [returnPickupTime, setReturnPickupTime] = useState<string>("")
  const [returnManual, setReturnManual] = useState(false)

  // --- Route (live result) ---
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null)
  const [routeError, setRouteError] = useState<string | null>(null)
  const [isCalculatingRoute, startRouteTransition] = useTransition()

  // --- Series (owned here, rendered by the #136 slot) ---
  const [enableSeries, setEnableSeries] = useState(false)
  const [recurrenceType, setRecurrenceType] = useState<string>("weekly")
  const [daysOfWeek, setDaysOfWeek] = useState<string[]>([])
  const [seriesEndDate, setSeriesEndDate] = useState<string>("")

  // --- Derived values ---
  const selectedPatient = useMemo(
    () => patientList.find((p) => p.id === selectedPatientId) ?? null,
    [patientList, selectedPatientId]
  )
  const selectedDestination = useMemo(
    () => destinationList.find((d) => d.id === selectedDestinationId) ?? null,
    [destinationList, selectedDestinationId]
  )

  // --- Inline-created entities (#134): append to the list + select immediately.
  // Selecting triggers the route/price recalc via the effect below. ---
  const handlePatientCreated = useCallback(
    (patient: CapturePatient) => {
      setPatientList((prev) =>
        [...prev, patient].sort((a, b) =>
          a.last_name.localeCompare(b.last_name)
        )
      )
      setSelectedPatientId(patient.id)
    },
    []
  )

  const handleDestinationCreated = useCallback(
    (destination: CaptureDestination) => {
      setDestinationList((prev) =>
        [...prev, destination].sort((a, b) =>
          a.display_name.localeCompare(b.display_name)
        )
      )
      setSelectedDestinationId(destination.id)
    },
    []
  )

  const durationMinutes = useMemo(() => {
    const parsed = parseInt(appointmentDuration, 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
  }, [appointmentDuration])

  const appointmentEndTime = useMemo(() => {
    if (!appointmentTime || durationMinutes <= 0) return ""
    return addMinutesToTime(appointmentTime, durationMinutes) ?? ""
  }, [appointmentTime, durationMinutes])

  const durationCategory: DurationCategory =
    durationMinutes >= OVER_2H_THRESHOLD_MINUTES ? "over_2h" : "under_2h"

  const isRoundTrip = rideType === "round_trip"

  // --- Live pickup-time suggestion (client preview; server is authoritative) ---
  const suggestedTimes = useMemo(
    () =>
      calculateRideTimes({
        appointment_time: appointmentTime || null,
        appointment_end_time: appointmentEndTime || null,
        duration_seconds: routeInfo?.duration_seconds ?? null,
        pickupBufferMinutes: timeBuffers.pickupBufferMinutes,
        boardingMinutes: timeBuffers.boardingMinutes,
        returnBufferMinutes: timeBuffers.returnBufferMinutes,
      }),
    [appointmentTime, appointmentEndTime, routeInfo, timeBuffers]
  )

  // --- Route calculation on patient/destination/pickup change ---
  // The override (if set) becomes the route origin; otherwise the server falls
  // back to the patient's home address (unchanged behavior).
  const calculateRoute = useCallback(
    (
      patientId: string,
      destinationId: string,
      override: PickupOverride | null
    ) => {
      startRouteTransition(async () => {
        setRouteError(null)
        const result = await calculateRouteForRide(
          patientId,
          destinationId,
          override ? { lat: override.lat, lng: override.lng } : null
        )
        if (result.success) {
          setRouteInfo(result.data)
        } else {
          setRouteError(result.error ?? "Routenberechnung fehlgeschlagen")
          setRouteInfo(null)
        }
      })
    },
    []
  )

  useEffect(() => {
    if (selectedPatientId && selectedDestinationId) {
      calculateRoute(selectedPatientId, selectedDestinationId, pickupOverride)
    } else {
      setRouteInfo(null)
      setRouteError(null)
    }
  }, [selectedPatientId, selectedDestinationId, pickupOverride, calculateRoute])

  // Reset the pickup override whenever the patient changes — an override is
  // location-specific and must not silently carry over to another patient.
  useEffect(() => {
    setPickupOverride(null)
  }, [selectedPatientId])

  // --- Keep the suggested pickup times in the fields until manually overridden ---
  useEffect(() => {
    if (!pickupManual && suggestedTimes.suggestedPickupTime) {
      setPickupTime(suggestedTimes.suggestedPickupTime)
    }
  }, [suggestedTimes.suggestedPickupTime, pickupManual])

  useEffect(() => {
    if (!returnManual && isRoundTrip && suggestedTimes.suggestedReturnPickupTime) {
      setReturnPickupTime(suggestedTimes.suggestedReturnPickupTime)
    }
  }, [suggestedTimes.suggestedReturnPickupTime, returnManual, isRoundTrip])

  // Resetting to the suggestion after a manual edit
  const resetPickupToSuggestion = useCallback(() => {
    if (suggestedTimes.suggestedPickupTime) {
      setPickupTime(suggestedTimes.suggestedPickupTime)
      setPickupManual(false)
    }
  }, [suggestedTimes.suggestedPickupTime])

  const resetReturnToSuggestion = useCallback(() => {
    if (suggestedTimes.suggestedReturnPickupTime) {
      setReturnPickupTime(suggestedTimes.suggestedReturnPickupTime)
      setReturnManual(false)
    }
  }, [suggestedTimes.suggestedReturnPickupTime])

  // Guard: round trip needs an appointment end time (server enforces this too).
  const roundTripMissingEnd = isRoundTrip && appointmentTime !== "" && !appointmentEndTime

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    // The core does not add client-side blocking; the server action validates
    // and never blocks on geo/price (#130). Nothing to intercept here yet.
    void event
  }

  return (
    <form
      action={formAction}
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_minmax(360px,440px)] lg:items-start"
    >
      {/* Derived / hidden fields consumed by createRide (#130). */}
      <input type="hidden" name="direction" value="outbound" />
      <input type="hidden" name="appointment_end_time" value={appointmentEndTime} />
      <input type="hidden" name="duration_category" value={durationCategory} />
      {isRoundTrip && <input type="hidden" name="create_return_ride" value="true" />}

      {/* Pickup-location override (#138). Only emitted when set; absent = NULL
          columns = patient home address (unchanged behavior). */}
      {pickupOverride && (
        <>
          <input
            type="hidden"
            name="pickup_location_text"
            value={pickupOverride.text}
          />
          <input
            type="hidden"
            name="pickup_lat"
            value={String(pickupOverride.lat)}
          />
          <input
            type="hidden"
            name="pickup_lng"
            value={String(pickupOverride.lng)}
          />
          <input
            type="hidden"
            name="pickup_place_id"
            value={pickupOverride.place_id ?? ""}
          />
        </>
      )}

      {/* ================= LEFT: capture ================= */}
      <div className="space-y-6">
        {state && !state.success && state.error && (
          <p
            className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            {state.error}
          </p>
        )}

        {/* --- WER --- */}
        <Card>
          <CardHeader>
            <SectionHeader step={1} title="Wer" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Patient</Label>
              <CapturePatientField
                patients={patientList}
                value={selectedPatientId}
                onChange={setSelectedPatientId}
                onCreateNew={handlePatientCreated}
                error={fieldErrors?.patient_id?.[0]}
                autoFocus
              />
            </div>
            <CostBearerDisplay patient={selectedPatient} />
            {/* key remounts the field on patient change so its internal input /
                mode reset together with the parent's pickupOverride reset. */}
            <PickupOverrideField
              key={selectedPatientId ?? "none"}
              patient={selectedPatient}
              value={pickupOverride}
              onChange={setPickupOverride}
            />
          </CardContent>
        </Card>

        {/* --- WOHIN & WANN --- */}
        <Card>
          <CardHeader>
            <SectionHeader step={2} title="Wohin & wann" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Ziel</Label>
              <CaptureDestinationField
                destinations={destinationList}
                value={selectedDestinationId}
                onChange={setSelectedDestinationId}
                onCreateNew={handleDestinationCreated}
                error={fieldErrors?.destination_id?.[0]}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="date">Datum</Label>
                <Input
                  id="date"
                  name="date"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
                {fieldErrors?.date && (
                  <p className="text-sm text-destructive">
                    {fieldErrors.date[0]}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="appointment_time">Terminbeginn</Label>
                <Input
                  id="appointment_time"
                  name="appointment_time"
                  type="time"
                  value={appointmentTime}
                  onChange={(e) => setAppointmentTime(e.target.value)}
                />
                {fieldErrors?.appointment_time && (
                  <p className="text-sm text-destructive">
                    {fieldErrors.appointment_time[0]}
                  </p>
                )}
              </div>
            </div>

            {/* Termindauer → derives appointment_end_time + tariff bucket */}
            <div className="space-y-2">
              <Label htmlFor="appointment_duration">Termindauer</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id="appointment_duration"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={15}
                  placeholder="Minuten"
                  className="w-32"
                  value={appointmentDuration}
                  onChange={(e) => setAppointmentDuration(e.target.value)}
                />
                <span className="text-sm text-muted-foreground">Min.</span>
                <div className="flex flex-wrap gap-1.5">
                  {DURATION_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAppointmentDuration(String(preset))}
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                        "focus:outline-none focus:ring-2 focus:ring-ring/40",
                        durationMinutes === preset
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-input bg-white text-muted-foreground hover:bg-muted/50"
                      )}
                      aria-pressed={durationMinutes === preset}
                    >
                      {preset < 60
                        ? `${preset} Min`
                        : preset % 60 === 0
                          ? `${preset / 60} Std`
                          : `${Math.floor(preset / 60)}:${String(preset % 60).padStart(2, "0")} Std`}
                    </button>
                  ))}
                </div>
              </div>
              {appointmentEndTime ? (
                <p className="text-xs text-muted-foreground">
                  Terminende:{" "}
                  <span className="font-medium text-foreground">
                    {appointmentEndTime}
                  </span>{" "}
                  (Terminbeginn + Termindauer)
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Aus Terminbeginn + Dauer wird das Terminende und die
                  Rückfahrt-Abholzeit berechnet.
                </p>
              )}
              {fieldErrors?.appointment_end_time && (
                <p className="text-sm text-destructive">
                  {fieldErrors.appointment_end_time[0]}
                </p>
              )}
            </div>

            {/* Requirements (chips filled by #135) */}
            <div className="space-y-2">
              <Label>Bedarf</Label>
              <RequirementChips
                value={requirements}
                onChange={setRequirements}
              />
            </div>
          </CardContent>
        </Card>

        {/* --- FAHRT --- */}
        <Card>
          <CardHeader>
            <SectionHeader step={3} title="Fahrt" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Fahrt-Typ</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    { value: "round_trip", label: "Hin + Rück" },
                    { value: "one_way", label: "Einzelfahrt (nur Hin)" },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRideType(option.value)}
                    className={cn(
                      "rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                      "focus:outline-none focus:ring-2 focus:ring-ring/40 focus:ring-offset-1",
                      rideType === option.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-input bg-white text-muted-foreground hover:bg-muted/50"
                    )}
                    aria-pressed={rideType === option.value}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {roundTripMissingEnd && (
                <p className="text-xs text-amber-700">
                  Für die Rückfahrt bitte eine Termindauer erfassen, damit das
                  Terminende bekannt ist.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notizen</Label>
              <Textarea id="notes" name="notes" rows={3} defaultValue="" />
              {fieldErrors?.notes && (
                <p className="text-sm text-destructive">
                  {fieldErrors.notes[0]}
                </p>
              )}
            </div>

            <SeriesToggle
              enabled={enableSeries}
              onEnabledChange={setEnableSeries}
              recurrenceType={recurrenceType}
              onRecurrenceTypeChange={setRecurrenceType}
              daysOfWeek={daysOfWeek}
              onDaysOfWeekChange={setDaysOfWeek}
              endDate={seriesEndDate}
              onEndDateChange={setSeriesEndDate}
              direction="outbound"
            />
          </CardContent>
        </Card>
      </div>

      {/* ================= RIGHT: live result ================= */}
      <aside className="space-y-4 lg:sticky lg:top-6">
        {/* Post-save panel (#139): confirmation + non-blocking warnings + the
            "Weiter zur Übersicht" / "Auftragsblatt öffnen" follow-up actions. */}
        {saved && savedRide && (
          <SaveResultPanel
            rideId={savedRide.id}
            date={savedRide.date}
            warnings={saveWarnings}
          />
        )}

        <RideMapPanel
          route={routeInfo}
          isLoading={isCalculatingRoute}
          error={routeError}
        />

        {/* Overridable pickup time(s) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Abholzeiten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pickup_time">
                Hin-Abholung <span className="text-destructive">*</span>
              </Label>
              <Input
                id="pickup_time"
                name="pickup_time"
                type="time"
                required
                value={pickupTime}
                onChange={(e) => {
                  setPickupTime(e.target.value)
                  setPickupManual(true)
                }}
              />
              {suggestedTimes.suggestedPickupTime && (
                <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  Vorschlag:{" "}
                  <span className="font-medium text-foreground">
                    {suggestedTimes.suggestedPickupTime}
                  </span>
                  {pickupManual &&
                    pickupTime !== suggestedTimes.suggestedPickupTime && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={resetPickupToSuggestion}
                      >
                        Übernehmen
                      </Button>
                    )}
                </p>
              )}
              {fieldErrors?.pickup_time && (
                <p className="text-sm text-destructive">
                  {fieldErrors.pickup_time[0]}
                </p>
              )}
            </div>

            {isRoundTrip && (
              <div className="space-y-2">
                <Label htmlFor="return_pickup_time">Rück-Abholung</Label>
                <Input
                  id="return_pickup_time"
                  name="return_pickup_time"
                  type="time"
                  value={returnPickupTime}
                  onChange={(e) => {
                    setReturnPickupTime(e.target.value)
                    setReturnManual(true)
                  }}
                />
                {suggestedTimes.suggestedReturnPickupTime ? (
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    Vorschlag:{" "}
                    <span className="font-medium text-foreground">
                      {suggestedTimes.suggestedReturnPickupTime}
                    </span>
                    {returnManual &&
                      returnPickupTime !==
                        suggestedTimes.suggestedReturnPickupTime && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={resetReturnToSuggestion}
                        >
                          Übernehmen
                        </Button>
                      )}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Wird aus dem Terminende berechnet.
                  </p>
                )}
                {fieldErrors?.return_pickup_time && (
                  <p className="text-sm text-destructive">
                    {fieldErrors.return_pickup_time[0]}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <RidePricePanel
          destination={selectedDestination}
          route={routeInfo}
          durationCategory={durationCategory}
          requirements={requirements}
          rideType={rideType}
        />

        {/* Save actions are hidden once saved so the ride is not submitted
            twice; follow-up actions live in the SaveResultPanel above. */}
        {!saved && <CaptureSaveActions />}
      </aside>
    </form>
  )
}
