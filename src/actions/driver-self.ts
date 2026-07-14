"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/require-auth"
import { driverSelfContactSchema } from "@/lib/validations/driver-self"
import type { ActionResult } from "@/actions/shared"
import type { Database } from "@/lib/types/database"

/** RPC argument shape (generated types type the text params as non-null). */
type ContactRpcArgs =
  Database["public"]["Functions"]["update_own_driver_contact"]["Args"]

/**
 * Update the caller's own driver contact/address fields (Issue #99).
 *
 * Security / correctness notes:
 *  - `requireAuth(["driver"])` gates the action; non-drivers are rejected.
 *  - The driver identity is NEVER taken from the client. The RPC derives it
 *    server-side via `get_user_driver_id()` and only touches the caller's row.
 *  - The RPC accepts exactly six parameters, so any extra keys a tampered
 *    request might send (e.g. `is_active`, `vehicle_type`) have no effect.
 *  - NULL-WIPE PROTECTION: the RPC overwrites ALL six columns from its
 *    arguments. The form must therefore always submit the full, pre-filled set
 *    (see ProfileForm). Because every field is present, unchanged values are
 *    re-sent verbatim and nothing is silently cleared. An intentionally emptied
 *    field is stored as NULL, which is the desired behaviour.
 */
export async function updateOwnContact(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const auth = await requireAuth(["driver"])
  if (!auth.authorized) {
    return { success: false, error: "Keine Berechtigung" }
  }

  const parsed = driverSelfContactSchema.safeParse({
    phone: formData.get("phone"),
    email: formData.get("email"),
    street: formData.get("street"),
    house_number: formData.get("house_number"),
    postal_code: formData.get("postal_code"),
    city: formData.get("city"),
  })

  if (!parsed.success) {
    return {
      success: false,
      error: "Bitte prüfen Sie Ihre Eingaben.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const supabase = await createClient()

  // The generated Args type marks the text params as non-null, but the SQL
  // function (text params) accepts NULL to clear a column. Cast to satisfy the
  // imprecise generated type while still passing genuine null values.
  const args = {
    p_phone: parsed.data.phone,
    p_email: parsed.data.email,
    p_street: parsed.data.street,
    p_house_number: parsed.data.house_number,
    p_postal_code: parsed.data.postal_code,
    p_city: parsed.data.city,
  } as unknown as ContactRpcArgs

  const { error } = await supabase.rpc("update_own_driver_contact", args)

  if (error) {
    return {
      success: false,
      error: "Speichern fehlgeschlagen. Bitte versuchen Sie es erneut.",
    }
  }

  revalidatePath("/fahrer/profil")
  return { success: true, data: undefined }
}
