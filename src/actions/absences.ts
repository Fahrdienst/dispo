"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/require-auth"
import {
  absenceRequestSchema,
  absenceDecisionSchema,
} from "@/lib/validations/absences"
import { canTransition } from "@/lib/absences/status-machine"
import { sendAbsenceDecisionNotification } from "@/lib/mail/send-absence-decision"
import { logAudit } from "@/lib/audit/logger"
import type { ActionResult } from "@/actions/shared"
import type { Database } from "@/lib/types/database"

/** RPC argument shape (generated types mark p_reason as non-null text). */
type RequestAbsenceArgs =
  Database["public"]["Functions"]["request_absence"]["Args"]

/**
 * PostgreSQL SQLSTATE for an exclusion-constraint violation. The
 * `driver_absences_no_overlap` GiST exclusion constraint raises this when a
 * requested/approved period overlaps an existing active absence. The SQLSTATE
 * propagates out of the SECURITY DEFINER RPC unchanged, so supabase-js exposes
 * it as `error.code`.
 */
const EXCLUSION_VIOLATION = "23P01"

/** SQLSTATE for a CHECK-constraint violation (e.g. end_date < start_date). */
const CHECK_VIOLATION = "23514"

/**
 * File a new absence request for the CURRENT driver (Issue #102).
 *
 * Security / correctness:
 *  - `requireAuth(["driver"])` gates the action.
 *  - The driver identity is NEVER read from the client: the `request_absence`
 *    RPC derives it server-side via `get_user_driver_id()` and forces
 *    `status = 'requested'`.
 *  - The DB exclusion constraint rejects overlapping active absences; we
 *    translate that SQLSTATE into a friendly German message instead of leaking
 *    the raw Postgres error.
 */
export async function requestAbsence(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const auth = await requireAuth(["driver"])
  if (!auth.authorized || !auth.driverId) {
    return { success: false, error: "Keine Berechtigung" }
  }

  const parsed = absenceRequestSchema.safeParse({
    type: formData.get("type"),
    start_date: formData.get("start_date"),
    end_date: formData.get("end_date"),
    reason: formData.get("reason"),
  })

  if (!parsed.success) {
    return {
      success: false,
      error: "Bitte prüfen Sie Ihre Eingaben.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const supabase = await createClient()

  // The SQL function accepts NULL for p_reason (optional), but the generated
  // Args type marks it non-null; cast to pass a genuine null through.
  const args = {
    p_type: parsed.data.type,
    p_start_date: parsed.data.start_date,
    p_end_date: parsed.data.end_date,
    p_reason: parsed.data.reason,
  } as unknown as RequestAbsenceArgs

  const { error } = await supabase.rpc("request_absence", args)

  if (error) {
    // Overlapping active absence -> friendly German message.
    if (
      error.code === EXCLUSION_VIOLATION ||
      error.message.includes("driver_absences_no_overlap")
    ) {
      return {
        success: false,
        error:
          "In diesem Zeitraum besteht bereits ein Antrag oder eine genehmigte Abwesenheit.",
      }
    }

    // Date range constraint (should already be caught by Zod, defensive).
    if (
      error.code === CHECK_VIOLATION ||
      error.message.includes("driver_absences_date_range")
    ) {
      return {
        success: false,
        error: "Das Enddatum darf nicht vor dem Startdatum liegen.",
      }
    }

    return {
      success: false,
      error:
        "Antrag konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.",
    }
  }

  revalidatePath("/fahrer/abwesenheiten")
  return { success: true, data: undefined }
}

/**
 * Cancel one of the CURRENT driver's own absence requests (Issue #102).
 *
 * Callable directly from a Client Component (via useTransition) rather than
 * through useFormState, because it acts on a single list item's id.
 *
 * The `cancel_own_absence` RPC only cancels a row the caller owns; the UI
 * additionally restricts the button to `requested` absences (canDriverCancel).
 */
export async function cancelOwnAbsence(
  absenceId: string
): Promise<ActionResult> {
  const auth = await requireAuth(["driver"])
  if (!auth.authorized || !auth.driverId) {
    return { success: false, error: "Keine Berechtigung" }
  }

  if (typeof absenceId !== "string" || absenceId.length === 0) {
    return { success: false, error: "Ungültige Anfrage." }
  }

  const supabase = await createClient()

  const { error } = await supabase.rpc("cancel_own_absence", {
    p_absence_id: absenceId,
  })

  if (error) {
    // The RPC raises when the row is missing, not owned, or no longer
    // cancellable. Any of these is a stale-UI situation for the driver.
    return {
      success: false,
      error:
        "Dieser Antrag kann nicht mehr storniert werden. Bitte laden Sie die Seite neu.",
    }
  }

  revalidatePath("/fahrer/abwesenheiten")
  return { success: true, data: undefined }
}

/**
 * Approve or reject a driver's absence request (Issue #103).
 *
 * Called directly from a Client Component (via useTransition), not through
 * useFormState, because it acts on a single list item's id.
 *
 * Security / correctness:
 *  - `requireAuth(["admin","operator"])` gates the action.
 *  - The deciding staff identity is NEVER read from the client: the
 *    `decide_absence` RPC stamps `decided_by = auth.uid()` and enforces the
 *    `requested -> approved|rejected` transition server-side.
 *  - We additionally check `canTransition` in application code (defence in
 *    depth + a friendly message) before invoking the RPC.
 *  - The email (#105) is fired AFTER the committed decision and can never roll
 *    it back — the sender swallows and logs its own failures.
 */
export async function decideAbsence(
  absenceId: string,
  decision: "approved" | "rejected",
  note: string | null
): Promise<ActionResult> {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return { success: false, error: "Keine Berechtigung" }
  }

  const parsed = absenceDecisionSchema.safeParse({
    absence_id: absenceId,
    decision,
    note,
  })
  if (!parsed.success) {
    return { success: false, error: "Ungültige Anfrage." }
  }

  const supabase = await createClient()

  // Load the current status to validate the transition up front (staff can
  // read all absences via RLS). The RPC re-checks this atomically.
  const { data: current, error: loadError } = await supabase
    .from("driver_absences")
    .select("status")
    .eq("id", parsed.data.absence_id)
    .single()

  if (loadError || !current) {
    return { success: false, error: "Antrag nicht gefunden." }
  }

  if (!canTransition(current.status, parsed.data.decision)) {
    return {
      success: false,
      error:
        "Dieser Antrag wurde bereits entschieden. Bitte laden Sie die Seite neu.",
    }
  }

  // The generated Args type marks p_note as non-null text; we intentionally
  // pass null, mirroring the request_absence arg cast above.
  type DecideAbsenceArgs =
    Database["public"]["Functions"]["decide_absence"]["Args"]

  const { error } = await supabase.rpc("decide_absence", {
    p_absence_id: parsed.data.absence_id,
    p_decision: parsed.data.decision,
    p_note: parsed.data.note,
  } as DecideAbsenceArgs)

  if (error) {
    return {
      success: false,
      error:
        "Entscheidung konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.",
    }
  }

  // [SEC review #103, Art. 15] Record who decided what. entityType "driver"
  // (audit enum has no "absence"); the decision detail lives in metadata.
  logAudit({
    userId: auth.userId,
    userRole: auth.role,
    action: "status_change",
    entityType: "driver",
    entityId: parsed.data.absence_id,
    metadata: {
      kind: "absence_decision",
      decision: parsed.data.decision,
      has_note: Boolean(parsed.data.note),
    },
  }).catch(() => {})

  // Fire the decision email. A mail failure must NOT surface as a failed
  // decision, so we never await its result into the error path — the sender
  // logs and swallows everything internally.
  void sendAbsenceDecisionNotification(parsed.data.absence_id)

  revalidatePath("/abwesenheiten")
  return { success: true, data: undefined }
}

/** A single conflicting ride shown in the absence form warning. */
export interface AbsenceRideConflict {
  id: string
  date: string
  pickup_time: string
}

/**
 * Count/collect the current driver's assigned rides within a candidate absence
 * period, so the form can warn before submitting (Issue #102).
 *
 * This is advisory only — the request is still allowed; the dispatch decides.
 * RLS restricts the driver to their own active rides, so this cannot leak
 * foreign data even though we filter defensively by driver_id.
 */
export async function checkAbsenceRideConflicts(
  startDate: string,
  endDate: string
): Promise<ActionResult<AbsenceRideConflict[]>> {
  const auth = await requireAuth(["driver"])
  if (!auth.authorized || !auth.driverId) {
    return { success: false, error: "Keine Berechtigung" }
  }

  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
  if (!ISO_DATE.test(startDate) || !ISO_DATE.test(endDate)) {
    return { success: false, error: "Ungültiger Zeitraum." }
  }

  const supabase = await createClient()

  // Assigned, still-active rides in the period. Cancelled rides don't conflict.
  const { data, error } = await supabase
    .from("rides")
    .select("id, date, pickup_time")
    .eq("driver_id", auth.driverId)
    .eq("is_active", true)
    .gte("date", startDate)
    .lte("date", endDate)
    .neq("status", "cancelled")
    .order("date")
    .order("pickup_time")

  if (error) {
    return { success: false, error: "Konflikte konnten nicht geprüft werden." }
  }

  return { success: true, data: data ?? [] }
}
