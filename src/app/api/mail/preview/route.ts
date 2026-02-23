import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/require-auth"
import { createClient } from "@/lib/supabase/server"
import { loadOrderSheetData } from "@/lib/mail/load-order-sheet-data"
import { assembleOrderSheet } from "@/lib/mail/templates/order-sheet"

/**
 * GET /api/mail/preview?ride_id=<uuid>
 *
 * Renders a preview of the order sheet email for a given ride.
 * Uses '#' for action button URLs (no real tokens generated).
 *
 * Auth: Requires admin or operator role.
 */
export async function GET(request: Request) {
  // Auth check
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 403 }
    )
  }

  // Parse ride_id from query params
  const { searchParams } = new URL(request.url)
  const rideId = searchParams.get("ride_id")

  if (!rideId) {
    return NextResponse.json(
      { error: "ride_id parameter required" },
      { status: 400 }
    )
  }

  // Load ride to get driver_id
  const supabase = await createClient()
  const { data: ride, error: rideError } = await supabase
    .from("rides")
    .select("id, driver_id")
    .eq("id", rideId)
    .single()

  if (rideError || !ride) {
    return NextResponse.json(
      { error: "Ride not found" },
      { status: 404 }
    )
  }

  if (!ride.driver_id) {
    return NextResponse.json(
      { error: "No driver assigned to this ride" },
      { status: 404 }
    )
  }

  // Load full order sheet data (uses admin client internally)
  try {
    const data = await loadOrderSheetData(rideId, ride.driver_id, "#", "#")
    const html = assembleOrderSheet(data)

    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
  } catch (err) {
    console.error("Mail preview failed:", err)
    return NextResponse.json(
      { error: "Failed to generate preview" },
      { status: 500 }
    )
  }
}
