/**
 * Shared, serializable data shapes for the /dispatch split-view (M15, #168).
 *
 * These are the props the server page (`dispatch/page.tsx`) computes and passes
 * down into the client split-view. Kept in a plain module (no "use client") so
 * both the server loader and the client components can import them without
 * pulling a component boundary across the server/client line.
 */

import type { Enums } from "@/lib/types/database"
import type { AssignmentStatus } from "@/lib/dispatch/assignment-status"
import type { AvailabilityRow } from "@/lib/availability/driver-status"

type RideStatus = Enums<"ride_status">
type RideDirection = Enums<"ride_direction">
type RideRequirement = Enums<"ride_requirement">
type VehicleType = Enums<"vehicle_type">

/** One ride card in the left column. */
export interface SplitRide {
  id: string
  date: string
  /** "HH:MM:SS" or "HH:MM". */
  pickup_time: string
  status: RideStatus
  /** Pre-derived on the server (§0). Only rides with a non-null bucket load. */
  assignmentStatus: AssignmentStatus
  direction: RideDirection
  patient_first_name: string
  patient_last_name: string
  /** Patient home town — the "Von" end of an outbound trip. May be null. */
  patient_city: string | null
  destination_name: string
  /** Operationally relevant transport requirements (wheelchair, companion, …). */
  requirements: RideRequirement[]
  parent_ride_id: string | null
  /** Assigned/requested driver id — needed for conflict detection (#169). */
  driver_id: string | null
  /** Route duration; null until calculated. Conflict window fallback: 60 min. */
  duration_seconds: number | null
  /** Currently requested driver, shown on Angefragt cards ("→ angefragt: …"). */
  assigned_driver_name: string | null
  /** Pickup time of the linked return ride, if any ("↩ Rückfahrt 11:00"). */
  linked_return_time: string | null
  /**
   * Whether the acceptance request is past its next SLA deadline at request
   * time. Initial SSR value — the live countdown (#171) keeps ticking client-
   * side and flips to «Überfällig» without a reload.
   */
  overdue: boolean
  /**
   * Absolute instant (ISO) of the next SLA deadline, computed via the shared
   * `nextDeadline` single source of truth. Null when no deadline is pending
   * (no active tracking, or already timed out).
   */
  next_deadline_at: string | null
  /** What that deadline escalates to — labels the countdown tooltip (#171). */
  next_deadline_stage: "reminder_1" | "timed_out" | null
  /** Driver who declined (Abgelehnt cards). */
  rejected_by_name: string | null
  /** When the decline happened (ISO). */
  rejected_at: string | null
}

/** One driver card in the right column. */
export interface SplitDriver {
  id: string
  first_name: string
  last_name: string
  vehicle_type: VehicleType
  /**
   * Today's availability slot starts ("08:00", "10:00", …). Empty when the
   * driver has no window today.
   */
  today_slots: string[]
  /**
   * Whether the driver is on an approved absence today. The REASON is never
   * exposed here (#187) — the UI shows a neutral "Nicht verfügbar" only.
   */
  is_absent_today: boolean
  /**
   * Neutral end date of the covering absence ("Nicht verfügbar bis …"), if
   * absent today. Never the reason.
   */
  absent_until: string | null
  /** Number of rides assigned to this driver in the selected period (week). */
  period_ride_count: number
  /**
   * Raw `driver_availability` rows (weekly grid + upcoming date exceptions),
   * so the client can resolve windows for the ACTIVE ride's date (#169).
   */
  availability: AvailabilityRow[]
  /**
   * Approved absence date ranges. Deliberately WITHOUT the absence type/reason
   * (#187) — the wire format itself is neutral, not just the rendering.
   */
  absences: SplitDriverAbsence[]
}

/** Neutral absence range (no type/reason — #187 data minimization). */
export interface SplitDriverAbsence {
  start_date: string
  end_date: string
}
