import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/require-auth"
import { PageHeader } from "@/components/dashboard/page-header"
import { AbsenceDecisionActions } from "@/components/absences/absence-decision-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDateDE } from "@/lib/utils/dates"
import { formatTime } from "@/lib/mail/utils"
import {
  ABSENCE_TYPE_LABELS,
  ABSENCE_STATUS_LABELS,
  ABSENCE_STATUS_BADGE_CLASSES,
  type AbsenceStatus,
} from "@/lib/absences/status-machine"

export const metadata: Metadata = {
  title: "Abwesenheiten - Dispo",
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Filter tabs: which status subset to show. */
type StatusFilter = "open" | "approved" | "all"

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "open", label: "Offen" },
  { value: "approved", label: "Genehmigt" },
  { value: "all", label: "Alle" },
]

interface AbsenceRow {
  id: string
  driver_id: string
  type: keyof typeof ABSENCE_TYPE_LABELS
  status: AbsenceStatus
  start_date: string
  end_date: string
  reason: string | null
  decision_note: string | null
  created_at: string
  drivers: { first_name: string; last_name: string } | null
}

interface ConflictRide {
  id: string
  date: string
  pickup_time: string
  driver_id: string
  patients: { first_name: string; last_name: string } | null
}

interface AbwesenheitenPageProps {
  searchParams: Promise<{ status?: string; from?: string; to?: string }>
}

/** Compact "Von – Bis" range, collapsing a single-day absence to one date. */
function formatRange(start: string, end: string): string {
  return start === end
    ? formatDateDE(start)
    : `${formatDateDE(start)} – ${formatDateDE(end)}`
}

function driverName(d: { first_name: string; last_name: string } | null): string {
  return d ? `${d.first_name} ${d.last_name}` : "Unbekannter Fahrer"
}

export default async function AbwesenheitenPage({
  searchParams,
}: AbwesenheitenPageProps): Promise<React.ReactElement> {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    redirect("/login")
  }

  const params = await searchParams
  const statusFilter: StatusFilter =
    params.status === "approved"
      ? "approved"
      : params.status === "all"
        ? "all"
        : "open"
  const from = params.from && ISO_DATE.test(params.from) ? params.from : ""
  const to = params.to && ISO_DATE.test(params.to) ? params.to : ""

  const supabase = await createClient()

  // Load absences (staff RLS allows reading all). Newest start date first.
  let query = supabase
    .from("driver_absences")
    .select(
      `id, driver_id, type, status, start_date, end_date, reason,
       decision_note, created_at,
       drivers!inner(first_name, last_name)`
    )
    .order("start_date", { ascending: false })

  if (statusFilter === "open") {
    query = query.eq("status", "requested")
  } else if (statusFilter === "approved") {
    query = query.eq("status", "approved")
  }

  // Date-range overlap: absence intersects [from, to].
  if (from) query = query.gte("end_date", from)
  if (to) query = query.lte("start_date", to)

  const { data: rawAbsences, error } = await query
  const absences = (rawAbsences ?? []) as unknown as AbsenceRow[]

  // Load conflicting rides for all visible absences in ONE query (avoids N+1),
  // then group them per absence in memory. RLS lets staff read all rides.
  const conflictsByAbsence = await loadConflicts(supabase, absences)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Abwesenheiten"
        description="Anträge der Fahrer prüfen, genehmigen oder ablehnen"
      />

      {/* Filters (GET form — no client JS needed). */}
      <form
        method="get"
        className="glass-panel flex flex-wrap items-end gap-3 rounded-2xl p-4"
      >
        <div className="flex gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f.value}
              type="submit"
              name="status"
              value={f.value}
              variant={statusFilter === f.value ? "default" : "outline"}
              size="sm"
            >
              {f.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Von
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Bis
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
            />
          </label>
          {/* Preserve the active status tab when filtering by date. */}
          <input type="hidden" name="status" value={statusFilter} />
          <Button type="submit" size="sm" variant="secondary">
            Filtern
          </Button>
          {(from || to) && (
            <Button asChild size="sm" variant="ghost">
              <Link href={`/abwesenheiten?status=${statusFilter}`}>
                Zurücksetzen
              </Link>
            </Button>
          )}
        </div>
      </form>

      {error ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-muted-foreground">
          Anträge konnten nicht geladen werden. Bitte laden Sie die Seite neu.
        </p>
      ) : absences.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-muted-foreground">
          {statusFilter === "open"
            ? "Keine offenen Anträge."
            : "Keine Anträge im gewählten Zeitraum."}
        </p>
      ) : (
        <ul className="space-y-4">
          {absences.map((a) => {
            const conflicts = conflictsByAbsence.get(a.id) ?? []
            return (
              <li
                key={a.id}
                className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-slate-900">
                      {driverName(a.drivers)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {ABSENCE_TYPE_LABELS[a.type]} ·{" "}
                      {formatRange(a.start_date, a.end_date)}
                    </p>
                  </div>
                  <Badge className={ABSENCE_STATUS_BADGE_CLASSES[a.status]}>
                    {ABSENCE_STATUS_LABELS[a.status]}
                  </Badge>
                </div>

                {a.reason && (
                  <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <span className="font-medium">Grund: </span>
                    {a.reason}
                  </p>
                )}

                {/* Conflicting rides as the decision basis. No auto-reassign. */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-900">
                    Betroffene Fahrten im Zeitraum
                    {conflicts.length > 0 && (
                      <span className="ml-1 text-muted-foreground">
                        ({conflicts.length})
                      </span>
                    )}
                  </p>
                  {conflicts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Keine zugeteilten Fahrten in diesem Zeitraum.
                    </p>
                  ) : (
                    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                      {conflicts.map((r) => (
                        <li key={r.id}>
                          <Link
                            href={`/rides/${r.id}`}
                            className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-slate-50"
                          >
                            <span className="text-slate-900">
                              {formatDateDE(r.date)}, {formatTime(r.pickup_time)}{" "}
                              Uhr
                            </span>
                            <span className="text-muted-foreground">
                              {r.patients
                                ? `${r.patients.first_name} ${r.patients.last_name}`
                                : "—"}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  {conflicts.length > 0 && a.status === "requested" && (
                    <p className="text-xs text-amber-700">
                      Hinweis: Diese Fahrten werden nicht automatisch neu
                      vergeben. Bitte nach der Genehmigung in der Disposition neu
                      zuteilen.
                    </p>
                  )}
                </div>

                {/* Already-decided note for context. */}
                {a.status !== "requested" && a.decision_note && (
                  <p
                    className={`rounded-lg px-3 py-2 text-sm ${
                      a.status === "rejected"
                        ? "bg-red-50 text-red-800"
                        : "bg-slate-50 text-slate-700"
                    }`}
                  >
                    <span className="font-medium">Anmerkung: </span>
                    {a.decision_note}
                  </p>
                )}

                {/* Decision controls only for still-open requests. */}
                {a.status === "requested" && (
                  <div className="border-t border-slate-100 pt-4">
                    <AbsenceDecisionActions absenceId={a.id} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/**
 * Load conflicting rides for every visible absence in a single query, grouped
 * by absence id. A ride conflicts when it belongs to the absence's driver, is
 * active, not cancelled, and its date falls within the absence period.
 */
async function loadConflicts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  absences: AbsenceRow[]
): Promise<Map<string, ConflictRide[]>> {
  const result = new Map<string, ConflictRide[]>()
  if (absences.length === 0) return result

  const driverIds = [...new Set(absences.map((a) => a.driver_id))]
  // Bound the query by the overall date window of all visible absences.
  const minStart = absences.reduce(
    (min, a) => (a.start_date < min ? a.start_date : min),
    absences[0]!.start_date
  )
  const maxEnd = absences.reduce(
    (max, a) => (a.end_date > max ? a.end_date : max),
    absences[0]!.end_date
  )

  const { data, error } = await supabase
    .from("rides")
    .select(
      `id, date, pickup_time, driver_id,
       patients!inner(first_name, last_name)`
    )
    .in("driver_id", driverIds)
    .eq("is_active", true)
    .neq("status", "cancelled")
    .gte("date", minStart)
    .lte("date", maxEnd)
    .order("date")
    .order("pickup_time")

  if (error || !data) return result

  const rides = data as unknown as ConflictRide[]

  // Assign each ride to every absence it falls within (driver + date range).
  for (const a of absences) {
    const matches = rides.filter(
      (r) =>
        r.driver_id === a.driver_id &&
        r.date >= a.start_date &&
        r.date <= a.end_date
    )
    result.set(a.id, matches)
  }

  return result
}
