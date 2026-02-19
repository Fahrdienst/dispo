/**
 * Ride status and direction display constants.
 *
 * Design system maintained by Kim (UX).
 * See .claude/agent-memory/ux-designer-kim/design-system.md for token rationale.
 *
 * COLOR SYSTEM RULES:
 * - RIDE_STATUS_COLORS: badge background + text (Tailwind classes, AA contrast)
 * - RIDE_STATUS_DOT_COLORS: solid dot inside badge (Tailwind bg class)
 * - RIDE_STATUS_BORDER_COLORS: left-border on list rows (Tailwind border-l class)
 * - Status colors are FUNCTIONAL, never decorative.
 * - Badge always shows: dot + text label (never color alone — accessibility).
 */

import type { Enums } from "@/lib/types/database"

type RideStatus = Enums<"ride_status">
type RideDirection = Enums<"ride_direction">

// =============================================================================
// GERMAN LABELS
// =============================================================================

/** German display labels for all ride statuses. */
export const RIDE_STATUS_LABELS: Record<RideStatus, string> = {
  unplanned:   "Ungeplant",
  planned:     "Geplant",
  confirmed:   "Bestätigt",
  rejected:    "Abgelehnt",
  in_progress: "Unterwegs",
  picked_up:   "Abgeholt",
  arrived:     "Angekommen",
  completed:   "Abgeschlossen",
  cancelled:   "Storniert",
  no_show:     "Nicht erschienen",
}

/** German display labels for ride directions. */
export const RIDE_DIRECTION_LABELS: Record<RideDirection, string> = {
  outbound: "Hinfahrt",
  return:   "Rückfahrt",
  both:     "Hin & Rück",
}

// =============================================================================
// BADGE COLOR TOKENS
// Applied to the status badge container: bg-* text-* classes.
// WCAG AA contrast verified for all combinations.
//
// Status         Bg class          Text class          Dot hex
// unplanned   →  bg-gray-100       text-gray-700       #6B7280 (gray-500)
// planned     →  bg-blue-100       text-blue-800       #3B82F6 (blue-500)
// confirmed   →  bg-indigo-100     text-indigo-800     #6366F1 (indigo-500)
// in_progress →  bg-amber-100      text-amber-800      #F59E0B (amber-500)
// picked_up   →  bg-orange-100     text-orange-800     #F97316 (orange-500)
// arrived     →  bg-teal-100       text-teal-800       #14B8A6 (teal-500)
// completed   →  bg-green-100      text-green-800      #16A34A (green-600)
// cancelled   →  bg-slate-100      text-slate-600      #94A3B8 (slate-400)
// rejected    →  bg-red-100        text-red-800        #EF4444 (red-500)
// no_show     →  bg-rose-100       text-rose-800       #E11D48 (rose-600)
// =============================================================================

/**
 * Badge background + text color classes for the status badge container.
 * Usage: <span className={RIDE_STATUS_COLORS[status]}>
 */
export const RIDE_STATUS_COLORS: Record<RideStatus, string> = {
  unplanned:   "bg-gray-100   text-gray-700",
  planned:     "bg-blue-100   text-blue-800",
  confirmed:   "bg-indigo-100 text-indigo-800",
  rejected:    "bg-red-100    text-red-800",
  in_progress: "bg-amber-100  text-amber-800",
  picked_up:   "bg-orange-100 text-orange-800",
  arrived:     "bg-teal-100   text-teal-800",
  completed:   "bg-green-100  text-green-800",
  cancelled:   "bg-slate-100  text-slate-600",
  no_show:     "bg-rose-100   text-rose-800",
}

/**
 * Solid dot color inside the status badge.
 * Usage: <span className={cn("h-1.5 w-1.5 rounded-full", RIDE_STATUS_DOT_COLORS[status])} />
 */
export const RIDE_STATUS_DOT_COLORS: Record<RideStatus, string> = {
  unplanned:   "bg-gray-500",
  planned:     "bg-blue-500",
  confirmed:   "bg-indigo-500",
  rejected:    "bg-red-500",
  in_progress: "bg-amber-500",
  picked_up:   "bg-orange-500",
  arrived:     "bg-teal-500",
  completed:   "bg-green-600",
  cancelled:   "bg-slate-400",
  no_show:     "bg-rose-600",
}

/**
 * Left-border color for ride list rows.
 * Encodes status at a glance before the badge is read.
 *
 * Special case: unplanned rides without an assigned driver should use
 * "border-l-4 border-l-red-600" (urgent) instead of this value.
 *
 * Usage: <div className={cn("border-l-4", RIDE_STATUS_BORDER_COLORS[status])}>
 */
export const RIDE_STATUS_BORDER_COLORS: Record<RideStatus, string> = {
  unplanned:   "border-l-gray-400",
  planned:     "border-l-blue-400",
  confirmed:   "border-l-indigo-400",
  rejected:    "border-l-red-500",
  in_progress: "border-l-amber-400",
  picked_up:   "border-l-orange-400",
  arrived:     "border-l-teal-400",
  completed:   "border-l-green-500",
  cancelled:   "border-l-slate-300",
  no_show:     "border-l-rose-500",
}

// =============================================================================
// CONVENIENCE HELPERS
// =============================================================================

/** Statuses that represent active transport (driver currently engaged). */
export const ACTIVE_RIDE_STATUSES: ReadonlySet<RideStatus> = new Set<RideStatus>([
  "in_progress",
  "picked_up",
  "arrived",
])

/** Statuses that require immediate dispatcher attention. */
export const ATTENTION_REQUIRED_STATUSES: ReadonlySet<RideStatus> = new Set<RideStatus>([
  "unplanned",
  "rejected",
])

/** All vehicle types with German labels. */
export const VEHICLE_TYPE_LABELS: Record<Enums<"vehicle_type">, string> = {
  standard:   "PKW",
  wheelchair: "Rollstuhlfahrzeug",
  stretcher:  "Liegefahrzeug",
}

/** Destination type labels in German. */
export const DESTINATION_TYPE_LABELS: Record<Enums<"destination_type">, string> = {
  hospital: "Krankenhaus",
  doctor:   "Arzt",
  therapy:  "Therapie",
  other:    "Sonstiges",
}
