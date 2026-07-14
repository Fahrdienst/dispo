import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/require-auth"
import { AbsenceRequestForm } from "@/components/driver/absence-request-form"
import { AbsenceCancelButton } from "@/components/driver/absence-cancel-button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { formatDateDE } from "@/lib/utils/dates"
import {
  ABSENCE_TYPE_LABELS,
  ABSENCE_STATUS_LABELS,
  ABSENCE_STATUS_BADGE_CLASSES,
  canDriverCancel,
} from "@/lib/absences/status-machine"

export const metadata: Metadata = {
  title: "Abwesenheiten - Fahrdienst",
}

/** Compact "Von – Bis" range, collapsing a single-day absence to one date. */
function formatRange(start: string, end: string): string {
  return start === end
    ? formatDateDE(start)
    : `${formatDateDE(start)} – ${formatDateDE(end)}`
}

export default async function DriverAbsencesPage(): Promise<React.ReactElement> {
  const auth = await requireAuth(["driver"])
  if (!auth.authorized || !auth.driverId) {
    redirect("/")
  }

  const supabase = await createClient()
  const { data: absences, error } = await supabase
    .from("driver_absences")
    .select(
      "id, type, status, start_date, end_date, reason, decision_note, created_at"
    )
    .eq("driver_id", auth.driverId)
    .order("start_date", { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Abwesenheiten
        </h1>
        <p className="text-sm text-muted-foreground">
          Ferien, Krankheit &amp; Co. beantragen
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <AbsenceRequestForm />
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Ihre Anträge</h2>

        {error ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-muted-foreground">
            Anträge konnten nicht geladen werden. Bitte laden Sie die Seite neu.
          </p>
        ) : !absences || absences.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-muted-foreground">
            Sie haben noch keine Abwesenheiten beantragt.
          </p>
        ) : (
          <ul className="space-y-3">
            {absences.map((a) => (
              <li
                key={a.id}
                className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-medium text-slate-900">
                      {ABSENCE_TYPE_LABELS[a.type]}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatRange(a.start_date, a.end_date)}
                    </p>
                  </div>
                  <Badge className={ABSENCE_STATUS_BADGE_CLASSES[a.status]}>
                    {ABSENCE_STATUS_LABELS[a.status]}
                  </Badge>
                </div>

                {a.reason && (
                  <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {a.reason}
                  </p>
                )}

                {a.status === "rejected" && a.decision_note && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
                    Begründung der Disposition: {a.decision_note}
                  </p>
                )}

                {canDriverCancel(a.status) ? (
                  <div className="flex justify-end">
                    <AbsenceCancelButton absenceId={a.id} />
                  </div>
                ) : a.status === "approved" ? (
                  <p className="text-xs text-muted-foreground">
                    Genehmigte Abwesenheiten werden über die Disposition
                    storniert.
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
