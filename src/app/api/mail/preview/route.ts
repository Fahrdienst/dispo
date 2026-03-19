import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/require-auth"
import { createClient } from "@/lib/supabase/server"
import { loadOrderSheetData } from "@/lib/mail/load-order-sheet-data"
import { assembleOrderSheet } from "@/lib/mail/templates/order-sheet"
import { getStaticMapUrl } from "@/lib/maps/utils"

/**
 * GET /api/mail/preview?ride_id=<uuid>
 *
 * Renders a preview of the order sheet email for a given ride.
 * Uses '#' for action button URLs (no real tokens generated).
 * Includes a route map image below the email (preview-only, not in the email itself
 * to avoid exposing the API key in outbound emails).
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
    let html = assembleOrderSheet(data)

    // Append route map section (preview-only)
    const routeMapHtml = buildPreviewRouteMap(data)
    if (routeMapHtml) {
      // Insert the route map before the closing </body> tag
      html = html.replace("</body>", `${routeMapHtml}</body>`)
    }

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

/**
 * Builds a route map HTML block for the web preview.
 * Uses the Static Maps API with the stored polyline.
 * Returns null if coordinates are missing or API key is not configured.
 */
function buildPreviewRouteMap(data: {
  patientLat: number | null
  patientLng: number | null
  destinationLat: number | null
  destinationLng: number | null
  polyline: string | null
}): string | null {
  if (
    data.patientLat == null ||
    data.patientLng == null ||
    data.destinationLat == null ||
    data.destinationLng == null
  ) {
    return null
  }

  const mapUrl = getStaticMapUrl({
    origin: { lat: data.patientLat, lng: data.patientLng },
    destination: { lat: data.destinationLat, lng: data.destinationLng },
    polyline: data.polyline,
    width: 600,
    height: 300,
  })

  if (!mapUrl) return null

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:0 16px 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding:16px 32px;background-color:#f8fafc;border-bottom:1px solid #e5e7eb;">
              <p style="margin:0;font-size:14px;font-weight:600;color:#1e293b;font-family:Arial,Helvetica,sans-serif;">
                Routenkarte (nur Vorschau)
              </p>
              <p style="margin:4px 0 0;font-size:12px;color:#94a3b8;font-family:Arial,Helvetica,sans-serif;">
                Diese Karte wird nicht in der E-Mail an den Fahrer angezeigt.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0;">
              <img src="${mapUrl}" alt="Routenkarte" width="600" height="300" style="display:block;width:100%;height:auto;border-bottom-left-radius:8px;border-bottom-right-radius:8px;" />
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`
}
