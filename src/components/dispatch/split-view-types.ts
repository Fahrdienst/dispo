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
  /** Currently requested driver, shown on Angefragt cards ("→ angefragt: …"). */
  assigned_driver_name: string | null
  /** Pickup time of the linked return ride, if any ("↩ Rückfahrt 11:00"). */
  linked_return_time: string | null
  /**
   * Whether the acceptance request is past its next SLA deadline. Static
   * server snapshot — the live countdown is Issue #171.
   */
  overdue: boolean
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
}
