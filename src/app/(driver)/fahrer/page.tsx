import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import {
  CalendarClock,
  CalendarX,
  ChevronRight,
  ClipboardList,
  User,
  type LucideIcon,
} from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/require-auth"
import { RideStatusBadge } from "@/components/shared/ride-status-badge"
import { RIDE_DIRECTION_LABELS } from "@/lib/rides/constants"
import { getToday, formatDateDE } from "@/lib/utils/dates"
import { cn } from "@/lib/utils"
import type { Enums } from "@/lib/types/database"

export const metadata: Metadata = {
  title: "Übersicht - Fahrdienst",
}

const MAX_UPCOMING_RIDES = 5

// ---------------------------------------------------------------------------
// Local absence labels/colours. Kept local (not shared) so this slice does not
// collide with the Abwesenheiten page built separately; they can be promoted to
// a shared module later if needed.
// ---------------------------------------------------------------------------

const ABSENCE_TYPE_LABELS: Record<Enums<"absence_type">, string> = {
  vacation: "Ferien",
  sick: "Krankheit",
  training: "Weiterbildung",
  other: "Sonstiges",
}

const OPEN_ABSENCE_STATUS: Record<
  "requested" | "approved",
  { label: string; className: string }
> = {
  requested: { label: "In Prüfung", className: "bg-amber-100 text-amber-800" },
  approved: { label: "Genehmigt", className: "bg-green-100 text-green-800" },
}

interface UpcomingRide {
  id: string
  date: string
  pickup_time: string
  status: Enums<"ride_status">
  direction: Enums<"ride_direction">
  patient_name: string
  destination_name: string
}

interface OpenAbsence {
  id: string
  type: Enums<"absence_type">
  status: "requested" | "approved"
  start_date: string
  end_date: string
}

export default async function DriverOverviewPage(): Promise<React.ReactElement> {
  const auth = await requireAuth(["driver"])
  if (!auth.authorized || !auth.driverId) {
    redirect("/")
  }

  const driverId = auth.driverId
  const today = getToday()
  const supabase = await createClient()

  const [driverResult, ridesResult, absencesResult] = await Promise.all([
    supabase
      .from("drivers")
      .select("first_name")
      .eq("id", driverId)
      .single(),

    // Next assigned rides (analog to /my/rides, but forward-looking across days)
    supabase
      .from("rides")
      .select(
        "id, date, pickup_time, status, direction, patients(first_name, last_name), destinations(display_name)"
      )
      .eq("driver_id", driverId)
      .eq("is_active", true)
      .gte("date", today)
      .order("date", { ascending: true })
      .order("pickup_time", { ascending: true })
      .limit(MAX_UPCOMING_RIDES),

    // Own absences that are still relevant: pending or approved, not yet ended.
    supabase
      .from("driver_absences")
      .select("id, type, status, start_date, end_date")
      .eq("driver_id", driverId)
      .in("status", ["requested", "approved"])
      .gte("end_date", today)
      .order("start_date", { ascending: true }),
  ])

  const firstName = driverResult.data?.first_name ?? null

  const upcomingRides: UpcomingRide[] = (ridesResult.data ?? []).map((ride) => {
    const patient = ride.patients as {
      first_name: string
      last_name: string
    } | null
    const destination = ride.destinations as { display_name: string } | null
    return {
      id: ride.id,
      date: ride.date,
      pickup_time: ride.pickup_time,
      status: ride.status,
      direction: ride.direction,
      patient_name: patient
        ? `${patient.last_name}, ${patient.first_name}`
        : "–",
      destination_name: destination?.display_name ?? "–",
    }
  })

  const openAbsences: OpenAbsence[] = (absencesResult.data ?? [])
    .filter(
      (a): a is typeof a & { status: "requested" | "approved" } =>
        a.status === "requested" || a.status === "approved"
    )
    .map((a) => ({
      id: a.id,
      type: a.type,
      status: a.status,
      start_date: a.start_date,
      end_date: a.end_date,
    }))

  const pendingCount = openAbsences.filter(
    (a) => a.status === "requested"
  ).length

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {firstName ? `Hallo, ${firstName}` : "Hallo"}
        </h1>
        <p className="text-sm text-muted-foreground">Ihre Übersicht</p>
      </div>

      {/* Next rides */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Nächste Fahrten
          </h2>
          <Link
            href="/my/rides"
            className="text-sm font-medium text-primary hover:underline"
          >
            Alle
          </Link>
        </div>

        {upcomingRides.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-muted-foreground">
            Keine anstehenden Fahrten.
          </p>
        ) : (
          <ul className="space-y-3">
            {upcomingRides.map((ride) => (
              <li key={ride.id}>
                <Link
                  href={`/my/rides?date=${ride.date}`}
                  className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-2xl font-bold tabular-nums text-slate-900">
                      {ride.pickup_time.slice(0, 5)}
                    </span>
                    <RideStatusBadge status={ride.status} />
                  </div>
                  <p className="mt-2 text-base font-medium text-slate-900">
                    {ride.patient_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {ride.destination_name}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDateDE(ride.date)} · {RIDE_DIRECTION_LABELS[ride.direction]}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Open / upcoming absences */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Meine Abwesenheiten
          </h2>
          <Link
            href="/fahrer/abwesenheiten"
            className="text-sm font-medium text-primary hover:underline"
          >
            Verwalten
          </Link>
        </div>

        {openAbsences.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-muted-foreground">
            Keine offenen Anträge oder geplanten Abwesenheiten.
          </p>
        ) : (
          <>
            {pendingCount > 0 && (
              <p className="text-sm text-slate-600">
                {pendingCount === 1
                  ? "1 Antrag wird geprüft."
                  : `${pendingCount} Anträge werden geprüft.`}
              </p>
            )}
            <ul className="space-y-3">
              {openAbsences.map((absence) => {
                const statusMeta = OPEN_ABSENCE_STATUS[absence.status]
                return (
                  <li
                    key={absence.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div>
                      <p className="text-base font-medium text-slate-900">
                        {ABSENCE_TYPE_LABELS[absence.type]}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatDateDE(absence.start_date)} –{" "}
                        {formatDateDE(absence.end_date)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-md px-2 py-0.5 text-xs font-medium",
                        statusMeta.className
                      )}
                    >
                      {statusMeta.label}
                    </span>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </section>

      {/* Quick access tiles */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Schnellzugriff</h2>
        <div className="space-y-3">
          <QuickTile
            href="/my/rides"
            label="Meine Fahrten"
            description="Fahrten des Tages ansehen und bearbeiten"
            icon={ClipboardList}
          />
          <QuickTile
            href="/fahrer/verfuegbarkeit"
            label="Verfügbarkeit"
            description="Wann Sie fahren können"
            icon={CalendarClock}
          />
          <QuickTile
            href="/fahrer/abwesenheiten"
            label="Abwesenheiten"
            description="Ferien und Krankheit melden"
            icon={CalendarX}
          />
          <QuickTile
            href="/fahrer/profil"
            label="Profil"
            description="Kontaktdaten aktualisieren"
            icon={User}
          />
        </div>
      </section>
    </div>
  )
}

interface QuickTileProps {
  href: string
  label: string
  description: string
  icon: LucideIcon
}

function QuickTile({
  href,
  label,
  description,
  icon: Icon,
}: QuickTileProps): React.ReactElement {
  return (
    <Link
      href={href}
      className="flex min-h-[72px] items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold text-slate-900">
          {label}
        </span>
        <span className="block text-sm text-muted-foreground">
          {description}
        </span>
      </span>
      <ChevronRight
        className="h-5 w-5 shrink-0 text-slate-400"
        aria-hidden="true"
      />
    </Link>
  )
}
