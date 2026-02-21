import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { consumeToken, invalidateTokensForRide } from "@/lib/mail/tokens"
import { canTransition } from "@/lib/rides/status-machine"
import { isAcceptanceFlowEnabled } from "@/lib/acceptance/constants"
import { resolveAcceptance } from "@/lib/acceptance/engine"
import type { Enums } from "@/lib/types/database"

const VALID_ACTIONS = ["confirm", "reject"] as const
type Action = (typeof VALID_ACTIONS)[number]

const ACTION_TO_STATUS: Record<Action, Enums<"ride_status">> = {
  confirm: "confirmed",
  reject: "rejected",
}

function errorRedirect(request: NextRequest, reason: string): NextResponse {
  const url = new URL("/rides/respond/error", request.url)
  url.searchParams.set("reason", reason)
  return NextResponse.redirect(url)
}

function successRedirect(request: NextRequest, action: string): NextResponse {
  const url = new URL("/rides/respond/success", request.url)
  url.searchParams.set("action", action)
  return NextResponse.redirect(url)
}

/**
 * SEC-M9-002: GET no longer mutates state.
 * Redirects to the confirm page for user to review and submit via POST.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const token = searchParams.get("token")
  const action = searchParams.get("action")

  if (!token || !action) {
    return errorRedirect(request, "invalid")
  }

  if (!VALID_ACTIONS.includes(action as Action)) {
    return errorRedirect(request, "invalid")
  }

  // Redirect to confirm page (no state change on GET)
  const url = new URL("/rides/respond/confirm", request.url)
  url.searchParams.set("token", token)
  url.searchParams.set("action", action)
  return NextResponse.redirect(url)
}

/**
 * POST: Actually consume the token and mutate ride status.
 * Called from the confirm page's form submission.
 */
export async function POST(request: NextRequest) {
  let token: string | null = null
  let action: string | null = null

  // Parse body (form data or JSON)
  const contentType = request.headers.get("content-type") ?? ""
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const formData = await request.formData()
    token = formData.get("token") as string | null
    action = formData.get("action") as string | null
  } else {
    try {
      const body = await request.json()
      token = body.token ?? null
      action = body.action ?? null
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }
  }

  // 1. Input validation
  if (!token || !action) {
    return errorRedirect(request, "invalid")
  }

  if (!VALID_ACTIONS.includes(action as Action)) {
    return errorRedirect(request, "invalid")
  }

  const validAction = action as Action

  // 2. Atomically consume token with action (SEC-M9-003: idempotency)
  const tokenData = await consumeToken(token, validAction)
  if (!tokenData) {
    return errorRedirect(request, "expired")
  }

  // SEC-M9-003: If token was already used with the same action, return success
  if (tokenData.already_used) {
    return successRedirect(request, validAction)
  }

  const supabase = createAdminClient()

  // 3. Load ride
  const { data: ride } = await supabase
    .from("rides")
    .select("id, status, driver_id, is_active")
    .eq("id", tokenData.ride_id)
    .single()

  if (!ride || !ride.is_active) {
    return errorRedirect(request, "invalid")
  }

  // 4. Check driver still assigned
  if (ride.driver_id !== tokenData.driver_id) {
    return errorRedirect(request, "changed")
  }

  // 5. Check status transition
  const targetStatus = ACTION_TO_STATUS[validAction]
  if (!canTransition(ride.status, targetStatus)) {
    return errorRedirect(request, "changed")
  }

  // 6. Update ride status
  const { error } = await supabase
    .from("rides")
    .update({ status: targetStatus })
    .eq("id", ride.id)

  if (error) {
    console.error("Failed to update ride status:", error.message)
    return errorRedirect(request, "invalid")
  }

  // 7. SEC-M9-006: Invalidate all other tokens for this ride
  await invalidateTokensForRide(tokenData.ride_id)

  // 8. Resolve acceptance tracking if enabled
  if (isAcceptanceFlowEnabled()) {
    const resolution = validAction === "confirm" ? "confirmed" : "rejected"
    await resolveAcceptance(
      tokenData.ride_id,
      resolution,
      "driver_email"
    )
  }

  // 9. Redirect to success page
  return successRedirect(request, validAction)
}
