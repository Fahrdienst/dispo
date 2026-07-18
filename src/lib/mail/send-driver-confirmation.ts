import { createAdminClient } from "@/lib/supabase/admin"
import { driverConfirmationEmail } from "@/lib/mail/templates/driver-confirmation"
import { buildRideIcs, type RideIcsInput } from "@/lib/mail/ics"
import { sendGuardedMail } from "@/lib/mail/send"
import { loadOrderSheetData } from "@/lib/mail/load-order-sheet-data"
import type { OrderSheetData } from "@/lib/mail/load-order-sheet-data"

const TEMPLATE = "driver-confirmation"

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

/** Map the loaded order-sheet data onto the minimal ICS input shape. */
function toIcsInput(data: OrderSheetData): RideIcsInput {
  return {
    rideId: data.rideId,
    date: data.date,
    pickupTime: data.pickupTime,
    appointmentTime: data.appointmentTime,
    direction: data.direction,
    patientFirstName: data.patientFirstName,
    patientLastName: data.patientLastName,
    patientPhone: data.patientPhone,
    patientStreet: data.patientStreet,
    patientHouseNumber: data.patientHouseNumber,
    patientPostalCode: data.patientPostalCode,
    patientCity: data.patientCity,
    destinationName: data.destinationName,
    destinationStreet: data.destinationStreet,
    destinationHouseNumber: data.destinationHouseNumber,
    destinationPostalCode: data.destinationPostalCode,
    destinationCity: data.destinationCity,
    patientImpairments: data.patientImpairments,
    notes: data.notes,
    organizationName: data.organizationName,
  }
}

/**
 * Send the post-acceptance confirmation email to a driver, with an .ics
 * calendar entry attached (M15, Issue #166).
 *
 * Fire-and-forget safe: never throws. Callers wire this after a successful
 * transition to `confirmed`; a mail failure must never roll back the status.
 */
export async function sendDriverConfirmation(
  rideId: string,
  driverId: string
): Promise<void> {
  const supabase = createAdminClient()

  // 1. Resolve recipient
  const recipientEmail = await resolveDriverEmail(supabase, driverId)
  if (!recipientEmail) {
    console.error("No email found for driver:", driverId)
    await supabase.from("mail_log").insert({
      ride_id: rideId,
      driver_id: driverId,
      template: TEMPLATE,
      recipient: "unknown",
      status: "failed",
      error: "No email found for driver",
    })
    return
  }

  // 2. Load ride data (reuse order-sheet loader; no action tokens needed here,
  //    the ride is already confirmed).
  let orderData: OrderSheetData
  try {
    orderData = await loadOrderSheetData(rideId, driverId, "", "")
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error"
    console.error("Failed to load confirmation data:", errorMessage)
    await supabase.from("mail_log").insert({
      ride_id: rideId,
      driver_id: driverId,
      template: TEMPLATE,
      recipient: recipientEmail,
      status: "failed",
      error: errorMessage,
    })
    return
  }

  // 3. Render template + build calendar attachment
  const { subject, html } = driverConfirmationEmail(orderData)
  const ics = buildRideIcs(toIcsInput(orderData))

  // 4. Send (through the sandbox guard)
  try {
    const guard = await sendGuardedMail({
      from: process.env.MAIL_FROM ?? process.env.GMAIL_USER,
      to: recipientEmail,
      subject,
      html,
      template: TEMPLATE,
      attachments: [
        {
          filename: "fahrt.ics",
          content: ics,
          contentType: "text/calendar; charset=utf-8; method=PUBLISH",
        },
      ],
    })

    await supabase.from("mail_log").insert({
      ride_id: rideId,
      driver_id: driverId,
      template: TEMPLATE,
      recipient: guard.auditLabel,
      status: guard.logStatus,
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error"
    console.error("Failed to send driver confirmation:", errorMessage)

    await supabase.from("mail_log").insert({
      ride_id: rideId,
      driver_id: driverId,
      template: TEMPLATE,
      recipient: recipientEmail,
      status: "failed",
      error: errorMessage,
    })
  }
}
