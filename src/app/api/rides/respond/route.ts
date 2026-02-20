import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { consumeToken } from "@/lib/mail/tokens"
import { canTransition } from "@/lib/rides/status-machine"
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

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const token = searchParams.get("token")
  const action = searchParams.get("action")

  // 1. Input validation
  if (!token || !action) {
    return errorRedirect(request, "invalid")
  }

  if (!VALID_ACTIONS.includes(action as Action)) {
    return errorRedirect(request, "invalid")
  }

  const validAction = action as Action

  // 2. Atomically consume token (validates + marks used in one step)
  const tokenData = await consumeToken(token)
  if (!tokenData) {
    return errorRedirect(request, "expired")
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

  // 7. Redirect to success page
  return successRedirect(request, validAction)
}
