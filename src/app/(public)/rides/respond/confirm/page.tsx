import { redirect } from "next/navigation"
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react"
import { peekToken } from "@/lib/mail/tokens"
import { createAdminClient } from "@/lib/supabase/admin"

const DIRECTION_LABELS: Record<string, string> = {
  outbound: "Hinfahrt",
  return: "Rueckfahrt",
  both: "Hin- & Rueckfahrt",
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00")
  return date.toLocaleDateString("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; action?: string }>
}) {
  const { token, action } = await searchParams

  if (!token || !action || !["confirm", "reject"].includes(action)) {
    redirect("/rides/respond/error?reason=invalid")
  }

  // Peek at the token without consuming it
  const tokenData = await peekToken(token)
  if (!tokenData) {
    redirect("/rides/respond/error?reason=expired")
  }

  // Load ride details for preview
  const supabase = createAdminClient()
  const { data: ride } = await supabase
    .from("rides")
    .select(`
      id, date, pickup_time, direction,
      patients!inner(first_name, last_name),
      destinations!inner(display_name)
    `)
    .eq("id", tokenData.ride_id)
    .single()

  if (!ride) {
    redirect("/rides/respond/error?reason=invalid")
  }

  const patient = ride.patients as unknown as {
    first_name: string
    last_name: string
  }
  const destination = ride.destinations as unknown as { display_name: string }
  const isConfirm = action === "confirm"

  const respondUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/rides/respond`

  return (
    <div className="text-center">
      <div className="mb-6 flex justify-center">
        {isConfirm ? (
          <CheckCircle2 className="h-16 w-16 text-green-500" />
        ) : (
          <AlertTriangle className="h-16 w-16 text-amber-500" />
        )}
      </div>

      <h2 className="mb-2 text-2xl font-bold text-gray-900">
        {isConfirm ? "Fahrt annehmen?" : "Fahrt ablehnen?"}
      </h2>

      <p className="mb-6 text-gray-600">
        {isConfirm
          ? "Bitte bestaetigen Sie die Uebernahme dieser Fahrt."
          : "Moechten Sie diese Fahrt wirklich ablehnen?"}
      </p>

      {/* Ride details */}
      <div className="mx-auto mb-8 max-w-sm rounded-lg bg-gray-50 p-4 text-left">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">Patient</dt>
            <dd className="font-medium text-gray-900">
              {patient.first_name} {patient.last_name}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Ziel</dt>
            <dd className="font-medium text-gray-900">
              {destination.display_name}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Datum</dt>
            <dd className="font-medium text-gray-900">
              {formatDate(ride.date)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Abholzeit</dt>
            <dd className="font-medium text-gray-900">
              {ride.pickup_time.slice(0, 5)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Richtung</dt>
            <dd className="font-medium text-gray-900">
              {DIRECTION_LABELS[ride.direction] ?? ride.direction}
            </dd>
          </div>
        </dl>
      </div>

      {/* POST form (SEC-M9-002: no state change on GET) */}
      <form action={respondUrl} method="POST">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="action" value={action} />

        <button
          type="submit"
          className={`inline-flex items-center gap-2 rounded-lg px-8 py-3 text-base font-semibold text-white ${
            isConfirm
              ? "bg-green-600 hover:bg-green-700"
              : "bg-red-600 hover:bg-red-700"
          }`}
        >
          {isConfirm ? (
            <>
              <CheckCircle2 className="h-5 w-5" />
              Fahrt annehmen
            </>
          ) : (
            <>
              <XCircle className="h-5 w-5" />
              Fahrt ablehnen
            </>
          )}
        </button>
      </form>

      <p className="mt-4 text-xs text-gray-400">
        Dieser Link ist 48 Stunden gueltig und kann nur einmal verwendet werden.
      </p>
    </div>
  )
}
