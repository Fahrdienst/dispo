import { createAdminClient } from "@/lib/supabase/admin"
import type { Enums } from "@/lib/types/database"

export type AssignmentEventType = Enums<"assignment_event_type">
export type AssignmentActor = Enums<"assignment_actor">

interface RecordAssignmentEventInput {
  rideId: string
  /** The event that occurred (see assignment_event_type enum). */
  event: AssignmentEventType
  /**
   * Who triggered the event. MUST be set server-side (dispatcher/driver/system)
   * from the authenticated session or system context — never from client input
   * (security finding #185).
   */
  actor: AssignmentActor
  driverId?: string | null
  acceptanceTrackingId?: string | null
  /** Optional free-text detail, e.g. rejection reason or reminder stage. */
  detail?: string | null
}

/**
 * Append an entry to the per-ride assignment status history (assignment_events).
 *
 * Writes go exclusively through the admin (service-role) client — the table has
 * no user-facing INSERT policy and is append-only (#185). This function is
 * intentionally fire-and-forget safe: it catches all errors internally so that
 * recording history never breaks the underlying assignment operation.
 *
 * The rights-binding audit proof lives in the immutable `audit_log` (#181); this
 * table is the dispatcher-facing operational timeline.
 */
export async function recordAssignmentEvent(
  input: RecordAssignmentEventInput
): Promise<void> {
  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from("assignment_events").insert({
      ride_id: input.rideId,
      driver_id: input.driverId ?? null,
      acceptance_tracking_id: input.acceptanceTrackingId ?? null,
      event: input.event,
      actor: input.actor,
      detail: input.detail ?? null,
    })

    if (error) {
      console.error(
        "[assignment-events] Failed to insert event:",
        error.message
      )
    }
  } catch (error) {
    // Recording history must never break the main assignment operation.
    console.error("[assignment-events] Failed to record event:", error)
  }
}
