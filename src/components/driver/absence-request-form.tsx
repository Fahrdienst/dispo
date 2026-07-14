"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useFormState, useFormStatus } from "react-dom"
import { AlertTriangle, ShieldCheck } from "lucide-react"
import {
  requestAbsence,
  checkAbsenceRideConflicts,
  type AbsenceRideConflict,
} from "@/actions/absences"
import { ABSENCE_TYPE_LABELS, type AbsenceType } from "@/lib/absences/status-machine"
import { formatDateDE } from "@/lib/utils/dates"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import type { ActionResult } from "@/actions/shared"

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const TYPE_OPTIONS: AbsenceType[] = ["vacation", "sick", "training", "other"]

function SubmitButton(): React.ReactElement {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="h-12 w-full text-base">
      {pending ? "Wird gesendet…" : "Abwesenheit beantragen"}
    </Button>
  )
}

export function AbsenceRequestForm(): React.ReactElement {
  const { toast } = useToast()
  const formRef = useRef<HTMLFormElement>(null)

  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    requestAbsence,
    null
  )
  const handledState = useRef<ActionResult | null>(null)

  // Controlled bits we need to react to: type (DSGVO hint) + dates (conflicts).
  const [type, setType] = useState<AbsenceType>("vacation")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  const [conflicts, setConflicts] = useState<AbsenceRideConflict[]>([])
  const [checking, startCheck] = useTransition()

  // Toast + reset on action completion.
  useEffect(() => {
    if (!state || state === handledState.current) return
    handledState.current = state

    if (state.success) {
      toast({
        title: "Antrag gesendet",
        description: "Ihr Abwesenheitsantrag wurde eingereicht.",
      })
      formRef.current?.reset()
      setType("vacation")
      setStartDate("")
      setEndDate("")
      setConflicts([])
    } else if (!state.fieldErrors && state.error) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: state.error,
      })
    }
  }, [state, toast])

  // Advisory conflict check whenever a valid, ordered date range is present.
  useEffect(() => {
    if (
      !ISO_DATE.test(startDate) ||
      !ISO_DATE.test(endDate) ||
      endDate < startDate
    ) {
      setConflicts([])
      return
    }

    startCheck(async () => {
      const result = await checkAbsenceRideConflicts(startDate, endDate)
      setConflicts(result.success ? result.data : [])
    })
  }, [startDate, endDate])

  const fieldErrors = state && !state.success ? state.fieldErrors : undefined

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      <fieldset className="space-y-4">
        <legend className="text-sm font-medium">Neue Abwesenheit</legend>

        {/* Type — native select works with FormData and gives a native picker
            (good for 60+ on mobile). */}
        <div className="space-y-2">
          <Label htmlFor="type">Typ</Label>
          <select
            id="type"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as AbsenceType)}
            className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {ABSENCE_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          {fieldErrors?.type && (
            <p className="text-sm text-destructive">{fieldErrors.type[0]}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="start_date">Von</Label>
          <Input
            id="start_date"
            name="start_date"
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-12 text-base"
          />
          {fieldErrors?.start_date && (
            <p className="text-sm text-destructive">
              {fieldErrors.start_date[0]}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="end_date">Bis</Label>
          <Input
            id="end_date"
            name="end_date"
            type="date"
            required
            min={startDate || undefined}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-12 text-base"
          />
          {fieldErrors?.end_date && (
            <p className="text-sm text-destructive">{fieldErrors.end_date[0]}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="reason">
            Begründung{" "}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="reason"
            name="reason"
            rows={3}
            maxLength={500}
            className="text-base"
          />
          {/* DSGVO / data-minimisation hint. Always dezent; explicit for sick. */}
          <p className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {type === "sick"
              ? "Bitte keine Gesundheitsdetails eingeben. Für eine Krankmeldung genügt der Zeitraum."
              : "Bitte nur das Nötigste angeben – keine sensiblen Daten."}
          </p>
          {fieldErrors?.reason && (
            <p className="text-sm text-destructive">{fieldErrors.reason[0]}</p>
          )}
        </div>
      </fieldset>

      {/* Advisory conflict warning: assigned rides in the chosen period. */}
      {conflicts.length > 0 && (
        <div
          role="status"
          className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <p className="flex items-start gap-2 font-medium">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0"
              aria-hidden="true"
            />
            {conflicts.length === 1
              ? "In diesem Zeitraum ist Ihnen bereits 1 Fahrt zugewiesen."
              : `In diesem Zeitraum sind Ihnen bereits ${conflicts.length} Fahrten zugewiesen.`}
          </p>
          <p className="text-amber-800">
            Sie können den Antrag trotzdem senden – die Disposition kümmert sich
            um die Umplanung.
          </p>
          <ul className="ml-1 list-inside space-y-0.5 text-amber-800">
            {conflicts.slice(0, 5).map((c) => (
              <li key={c.id}>
                {formatDateDE(c.date)}, {c.pickup_time.slice(0, 5)} Uhr
              </li>
            ))}
            {conflicts.length > 5 && (
              <li>… und {conflicts.length - 5} weitere</li>
            )}
          </ul>
        </div>
      )}

      {checking && (
        <p className="text-xs text-muted-foreground">Fahrten werden geprüft…</p>
      )}

      <SubmitButton />
    </form>
  )
}
