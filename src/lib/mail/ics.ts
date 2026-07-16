/**
 * iCalendar (.ics) generator for ride confirmation emails (M15, Issue #166).
 *
 * Produces a self-contained RFC 5545 VCALENDAR/VEVENT that a driver can add to
 * their calendar directly from the confirmation email attachment.
 *
 * Design decisions:
 * - METHOD:PUBLISH (not REQUEST): the driver has *already* accepted the ride via
 *   the email flow, so this is a purely informational "add-to-calendar" event —
 *   not an invitation awaiting an RSVP. PUBLISH avoids ORGANIZER/ATTENDEE RSVP
 *   semantics that would be misleading here and is universally supported by
 *   calendar clients for attachment import.
 * - Stable UID derived from the ride id, so a re-sent confirmation (e.g. after a
 *   dispatcher override reassigns the same ride back) updates the existing
 *   calendar entry instead of creating a duplicate.
 * - Times are converted from Europe/Zurich wall-clock to UTC (`...Z`) using the
 *   host ICU database. This is unambiguous across DST without shipping a
 *   hand-written VTIMEZONE block.
 *
 * No external dependency is introduced: the format is small and fully covered by
 * unit tests (timezone conversion, escaping, structure round-trip).
 */

import { IMPAIRMENT_TYPE_LABELS, RIDE_DIRECTION_LABELS } from "@/lib/rides/constants"

/** Fallback event length (minutes) when no appointment time is available. */
const DEFAULT_RIDE_DURATION_MINUTES = 60

const ICS_TIMEZONE = "Europe/Zurich"

/**
 * Minimal ride data required to build a calendar event.
 * A subset of {@link import("./load-order-sheet-data").OrderSheetData} so the
 * loader can be reused directly (see send-driver-confirmation.ts).
 */
export interface RideIcsInput {
  rideId: string
  date: string // YYYY-MM-DD (local Europe/Zurich date)
  pickupTime: string // HH:MM or HH:MM:SS (Europe/Zurich wall-clock)
  appointmentTime: string | null // HH:MM[:SS] — used for DTEND when present
  direction: string // ride_direction enum value

  patientFirstName: string
  patientLastName: string
  patientPhone: string | null
  patientStreet: string | null
  patientHouseNumber: string | null
  patientPostalCode: string | null
  patientCity: string | null

  destinationName: string
  destinationStreet: string | null
  destinationHouseNumber: string | null
  destinationPostalCode: string | null
  destinationCity: string | null

  patientImpairments: string[] // impairment_type enum values
  notes: string | null

  organizationName: string
}

// ---------------------------------------------------------------------------
// Timezone conversion (Europe/Zurich wall-clock -> UTC)
// ---------------------------------------------------------------------------

/**
 * Offset of `timeZone` from UTC at the given instant, in minutes
 * (positive = ahead of UTC). Europe/Zurich is +60 (winter) or +120 (summer).
 */
function timeZoneOffsetMinutes(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })

  const parts = dtf.formatToParts(instant)
  const map: Record<string, number> = {}
  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = Number(part.value)
    }
  }

  // `hour` can come back as 24 at midnight in some ICU versions — normalize.
  const hour = map.hour === 24 ? 0 : map.hour ?? 0

  const asUtc = Date.UTC(
    map.year ?? 1970,
    (map.month ?? 1) - 1,
    map.day ?? 1,
    hour,
    map.minute ?? 0,
    map.second ?? 0
  )

  return (asUtc - instant.getTime()) / 60000
}

/**
 * Parse "HH:MM" / "HH:MM:SS" into total minutes since midnight.
 * Invalid input falls back to 0.
 */
function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":")
  const hours = Number(h)
  const minutes = Number(m)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0
  return hours * 60 + minutes
}

/**
 * Convert a Europe/Zurich wall-clock date+time to the corresponding UTC instant.
 * Two-pass to stay correct within the one-hour DST transition window.
 */
function zurichWallTimeToUtc(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number)
  const totalMinutes = parseTimeToMinutes(timeStr)
  const hour = Math.floor(totalMinutes / 60)
  const minute = totalMinutes % 60

  const guess = new Date(
    Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1, hour, minute, 0)
  )

  const offset1 = timeZoneOffsetMinutes(guess, ICS_TIMEZONE)
  const utc1 = new Date(guess.getTime() - offset1 * 60000)
  const offset2 = timeZoneOffsetMinutes(utc1, ICS_TIMEZONE)
  return new Date(guess.getTime() - offset2 * 60000)
}

/** Format a Date as an RFC 5545 UTC timestamp: YYYYMMDDTHHMMSSZ. */
function formatUtcStamp(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, "0")
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  )
}

// ---------------------------------------------------------------------------
// RFC 5545 text handling
// ---------------------------------------------------------------------------

/**
 * Escape a text value per RFC 5545 §3.3.11.
 * Backslash, semicolon and comma are escaped; newlines become the literal `\n`.
 */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n")
}

/**
 * Fold a content line to a maximum of 75 octets per RFC 5545 §3.1, breaking on
 * character boundaries so multi-byte UTF-8 sequences (umlauts) are never split.
 * Continuation lines start with a single space.
 */
function foldLine(line: string): string {
  const MAX_OCTETS = 75
  const encoder = new TextEncoder()

  let result = ""
  let current = ""
  let currentOctets = 0
  let isContinuation = false

  for (const char of line) {
    const charOctets = encoder.encode(char).length
    // Continuation lines have a leading space, reducing usable width by 1.
    const limit = isContinuation ? MAX_OCTETS - 1 : MAX_OCTETS

    if (currentOctets + charOctets > limit) {
      result += (result ? "\r\n " : "") + current
      current = char
      currentOctets = charOctets
      isContinuation = true
    } else {
      current += char
      currentOctets += charOctets
    }
  }

  result += (result ? "\r\n " : "") + current
  return result
}

// ---------------------------------------------------------------------------
// Event content
// ---------------------------------------------------------------------------

function fullAddress(
  street: string | null,
  houseNumber: string | null,
  postalCode: string | null,
  city: string | null
): string {
  const line1 =
    street && houseNumber
      ? `${street} ${houseNumber}`
      : street ?? houseNumber ?? ""
  const line2 =
    postalCode && city ? `${postalCode} ${city}` : postalCode ?? city ?? ""
  return [line1, line2].filter(Boolean).join(", ")
}

interface RouteEndpoints {
  /** Where the driver picks the patient up (LOCATION). */
  pickupAddress: string
  /** Human-readable origin for the SUMMARY. */
  fromLabel: string
  /** Human-readable destination for the SUMMARY. */
  toLabel: string
  /** Full address of the drop-off, for the DESCRIPTION. */
  dropoffAddress: string
}

/**
 * Resolve pickup/drop-off endpoints based on ride direction.
 * For `return` rides the patient is collected at the destination and driven
 * home; for `outbound`/`both` the patient is collected at home.
 */
function resolveRoute(input: RideIcsInput): RouteEndpoints {
  const patientAddress = fullAddress(
    input.patientStreet,
    input.patientHouseNumber,
    input.patientPostalCode,
    input.patientCity
  )
  const destinationAddress = fullAddress(
    input.destinationStreet,
    input.destinationHouseNumber,
    input.destinationPostalCode,
    input.destinationCity
  )

  const patientLabel = input.patientCity ?? "Abholung"
  const destinationLabel = input.destinationName

  if (input.direction === "return") {
    return {
      pickupAddress: destinationAddress,
      fromLabel: destinationLabel,
      toLabel: patientLabel,
      dropoffAddress: patientAddress,
    }
  }

  return {
    pickupAddress: patientAddress,
    fromLabel: patientLabel,
    toLabel: destinationLabel,
    dropoffAddress: destinationAddress,
  }
}

/**
 * Build the multi-line DESCRIPTION. Kept to operationally-relevant details only
 * (tiered disclosure, Findings #177/#179): patient identity + contact, the
 * route, mobility aids needed for the transfer, and free-text notes. No
 * diagnosis or health data beyond the mobility requirements is included.
 */
function buildDescription(input: RideIcsInput, route: RouteEndpoints): string {
  const patientName = `${input.patientFirstName} ${input.patientLastName}`.trim()
  const directionLabel =
    RIDE_DIRECTION_LABELS[input.direction as keyof typeof RIDE_DIRECTION_LABELS] ??
    input.direction

  const impairments = input.patientImpairments
    .map(
      (imp) =>
        IMPAIRMENT_TYPE_LABELS[imp as keyof typeof IMPAIRMENT_TYPE_LABELS] ?? imp
    )
    .join(", ")

  const lines: string[] = [`Fahrgast: ${patientName}`]

  if (input.patientPhone) lines.push(`Telefon: ${input.patientPhone}`)
  lines.push(`Richtung: ${directionLabel}`)
  if (route.pickupAddress) lines.push(`Abholung: ${route.pickupAddress}`)
  if (route.dropoffAddress) lines.push(`Ziel: ${route.dropoffAddress}`)
  if (input.appointmentTime) {
    lines.push(`Termin: ${input.appointmentTime.slice(0, 5)} Uhr`)
  }
  if (impairments) lines.push(`Hilfsmittel: ${impairments}`)
  if (input.notes) lines.push(`Hinweise: ${input.notes}`)

  return lines.join("\n")
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a valid iCalendar document for a confirmed ride.
 *
 * @param input Ride/patient/destination data.
 * @param now   Injectable clock for DTSTAMP (defaults to the current time);
 *              exposed for deterministic tests.
 */
export function buildRideIcs(input: RideIcsInput, now: Date = new Date()): string {
  const route = resolveRoute(input)

  const startUtc = zurichWallTimeToUtc(input.date, input.pickupTime)

  const pickupMinutes = parseTimeToMinutes(input.pickupTime)
  const appointmentMinutes =
    input.appointmentTime !== null
      ? parseTimeToMinutes(input.appointmentTime)
      : null
  const durationMinutes =
    appointmentMinutes !== null && appointmentMinutes > pickupMinutes
      ? appointmentMinutes - pickupMinutes
      : DEFAULT_RIDE_DURATION_MINUTES
  const endUtc = new Date(startUtc.getTime() + durationMinutes * 60000)

  const summary = `Fahrt: ${route.fromLabel} → ${route.toLabel}`
  const description = buildDescription(input, route)

  // UID is stable per ride so re-sends replace the existing calendar entry.
  const uid = `ride-${input.rideId}@fahrdienst`

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${input.organizationName}//Dispo//DE`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    "SEQUENCE:0",
    `DTSTAMP:${formatUtcStamp(now)}`,
    `DTSTART:${formatUtcStamp(startUtc)}`,
    `DTEND:${formatUtcStamp(endUtc)}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    ...(route.pickupAddress
      ? [`LOCATION:${escapeIcsText(route.pickupAddress)}`]
      : []),
    `DESCRIPTION:${escapeIcsText(description)}`,
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    "END:VEVENT",
    "END:VCALENDAR",
  ]

  // RFC 5545 requires CRLF line endings; fold each line to 75 octets.
  return lines.map(foldLine).join("\r\n") + "\r\n"
}
