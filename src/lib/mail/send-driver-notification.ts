import { createAdminClient } from "@/lib/supabase/admin"
import { createAssignmentToken } from "@/lib/mail/tokens"
import { driverAssignmentEmail } from "@/lib/mail/templates/driver-assignment"
import { mailTransport } from "@/lib/mail/transport"

const DIRECTION_LABELS: Record<string, string> = {
  outbound: "Hinfahrt",
  return: "Rueckfahrt",
  both: "Hin- & Rueckfahrt",
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00")
  const days = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"]
  const months = [
    "Jan", "Feb", "Mär", "Apr", "Mai", "Jun",
    "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
  ]
  const day = days[date.getDay()]
  return `${day}, ${date.getDate()}. ${months[date.getMonth()]} ${date.getFullYear()}`
}

export async function sendDriverNotification(
  rideId: string,
  driverId: string
): Promise<void> {
  const supabase = createAdminClient()

  // 1. Load ride with patient and destination
  const { data: ride, error: rideError } = await supabase
    .from("rides")
    .select(`
      id, date, pickup_time, direction,
      patients!inner(first_name, last_name),
      destinations!inner(display_name)
    `)
    .eq("id", rideId)
    .single()

  if (rideError || !ride) {
    console.error("Failed to load ride for notification:", rideError?.message)
    return
  }

  // 2. Load driver email via profiles join
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("email, display_name")
    .eq("driver_id", driverId)
    .single()

  if (profileError || !profile) {
    console.error("No profile found for driver:", driverId)

    await supabase.from("mail_log").insert({
      ride_id: rideId,
      driver_id: driverId,
      template: "driver-assignment",
      recipient: "unknown",
      status: "failed",
      error: "No profile/email found for driver",
    })
    return
  }

  // 3. Create token
  const token = await createAssignmentToken(rideId, driverId)

  // 4. Build action URLs
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    console.error("NEXT_PUBLIC_APP_URL is not configured, cannot send notification")
    return
  }
  const confirmUrl = `${appUrl}/api/rides/respond?token=${token}&action=confirm`
  const rejectUrl = `${appUrl}/api/rides/respond?token=${token}&action=reject`

  // 5. Render template
  const patient = ride.patients as unknown as { first_name: string; last_name: string }
  const destination = ride.destinations as unknown as { display_name: string }

  const { subject, html } = driverAssignmentEmail({
    driverName: profile.display_name,
    patientName: `${patient.first_name} ${patient.last_name}`,
    destinationName: destination.display_name,
    date: formatDate(ride.date),
    pickupTime: ride.pickup_time,
    direction: DIRECTION_LABELS[ride.direction] ?? ride.direction,
    confirmUrl,
    rejectUrl,
  })

  // 6. Send email
  try {
    await mailTransport.sendMail({
      from: process.env.MAIL_FROM ?? process.env.GMAIL_USER,
      to: profile.email,
      subject,
      html,
    })

    // 7. Log success
    await supabase.from("mail_log").insert({
      ride_id: rideId,
      driver_id: driverId,
      template: "driver-assignment",
      recipient: profile.email,
      status: "sent",
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error"
    console.error("Failed to send driver notification:", errorMessage)

    // Log failure
    await supabase.from("mail_log").insert({
      ride_id: rideId,
      driver_id: driverId,
      template: "driver-assignment",
      recipient: profile.email,
      status: "failed",
      error: errorMessage,
    })
  }
}
