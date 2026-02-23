import { createAdminClient } from "@/lib/supabase/admin"
import { createAssignmentToken } from "@/lib/mail/tokens"
import { assembleOrderSheet } from "@/lib/mail/templates/order-sheet"
import { mailTransport } from "@/lib/mail/transport"
import { formatDate, formatTime } from "@/lib/mail/utils"
import { loadOrderSheetData } from "@/lib/mail/load-order-sheet-data"
import type { OrderSheetData } from "@/lib/mail/load-order-sheet-data"

/**
 * Resolve the email address for a driver.
 * Prefers drivers.email, falls back to profiles.email (auth user).
 */
async function resolveDriverEmail(
  supabase: ReturnType<typeof createAdminClient>,
  driverId: string
): Promise<string | null> {
  const { data: driver } = await supabase
    .from("drivers")
    .select("email")
    .eq("id", driverId)
    .single()

  if (driver?.email) return driver.email

  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("driver_id", driverId)
    .single()

  return profile?.email ?? null
}

export async function sendDriverNotification(
  rideId: string,
  driverId: string
): Promise<void> {
  const supabase = createAdminClient()

  // 1. Resolve recipient email (independent of order sheet data)
  const recipientEmail = await resolveDriverEmail(supabase, driverId)
  if (!recipientEmail) {
    console.error("No email found for driver:", driverId)
    await supabase.from("mail_log").insert({
      ride_id: rideId,
      driver_id: driverId,
      template: "order-sheet",
      recipient: "unknown",
      status: "failed",
      error: "No email found for driver",
    })
    return
  }

  // 2. Create token and build action URLs
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    console.error("NEXT_PUBLIC_APP_URL is not configured, cannot send notification")
    return
  }

  const token = await createAssignmentToken(rideId, driverId)
  const confirmUrl = `${appUrl}/api/rides/respond?token=${token}&action=confirm`
  const rejectUrl = `${appUrl}/api/rides/respond?token=${token}&action=reject`

  // 3. Load all order sheet data via shared loader
  let orderData: OrderSheetData
  try {
    orderData = await loadOrderSheetData(rideId, driverId, confirmUrl, rejectUrl)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error"
    console.error("Failed to load order sheet data:", errorMessage)
    await supabase.from("mail_log").insert({
      ride_id: rideId,
      driver_id: driverId,
      template: "order-sheet",
      recipient: recipientEmail,
      status: "failed",
      error: errorMessage,
    })
    return
  }

  // 4. Render template using the full order sheet
  const html = assembleOrderSheet(orderData)
  const subject = `Neuer Auftrag \u2013 ${formatDate(orderData.date)}, ${formatTime(orderData.pickupTime)} Uhr`

  // 5. Send email
  try {
    await mailTransport.sendMail({
      from: process.env.MAIL_FROM ?? process.env.GMAIL_USER,
      to: recipientEmail,
      subject,
      html,
    })

    await supabase.from("mail_log").insert({
      ride_id: rideId,
      driver_id: driverId,
      template: "order-sheet",
      recipient: recipientEmail,
      status: "sent",
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error"
    console.error("Failed to send driver notification:", errorMessage)

    await supabase.from("mail_log").insert({
      ride_id: rideId,
      driver_id: driverId,
      template: "order-sheet",
      recipient: recipientEmail,
      status: "failed",
      error: errorMessage,
    })
  }
}
