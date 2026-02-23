import { createAdminClient } from "@/lib/supabase/admin"
import { createAssignmentToken } from "@/lib/mail/tokens"
import { driverAssignmentEmail } from "@/lib/mail/templates/driver-assignment"
import { mailTransport } from "@/lib/mail/transport"
import { formatDate } from "@/lib/mail/utils"
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

/**
 * Build template input from OrderSheetData.
 * Currently uses the minimal fields for the assignment template.
 * Will be expanded in M11 Phase 2 for the full order sheet.
 */
function buildAssignmentTemplateData(data: OrderSheetData): {
  driverName: string
  patientName: string
  destinationName: string
  date: string
  pickupTime: string
  direction: string
  confirmUrl: string
  rejectUrl: string
} {
  return {
    driverName: `${data.driverFirstName} ${data.driverLastName}`,
    patientName: `${data.patientFirstName} ${data.patientLastName}`,
    destinationName: data.destinationName,
    date: formatDate(data.date),
    pickupTime: data.pickupTime,
    direction: data.direction,
    confirmUrl: data.confirmUrl,
    rejectUrl: data.rejectUrl,
  }
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
      template: "driver-assignment",
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
      template: "driver-assignment",
      recipient: recipientEmail,
      status: "failed",
      error: errorMessage,
    })
    return
  }

  // 4. Render template
  const { subject, html } = driverAssignmentEmail(buildAssignmentTemplateData(orderData))

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
      template: "driver-assignment",
      recipient: recipientEmail,
      status: "sent",
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error"
    console.error("Failed to send driver notification:", errorMessage)

    await supabase.from("mail_log").insert({
      ride_id: rideId,
      driver_id: driverId,
      template: "driver-assignment",
      recipient: recipientEmail,
      status: "failed",
      error: errorMessage,
    })
  }
}
