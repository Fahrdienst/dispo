"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Timer } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  formatRemaining,
  deadlineStageLabel,
} from "@/lib/dispatch/countdown-format"

/** Tick once per 30s — minute-granularity display needs no faster cadence. */
const TICK_MS = 30_000

interface AcceptanceCountdownProps {
  /** ISO instant of the next SLA deadline, or null when none is pending. */
  dueAt: string | null
  /** What the deadline escalates to (tooltip label). */
  nextStage: "reminder_1" | "timed_out" | null
  /** Server-side overdue snapshot — the pre-hydration and no-deadline state. */
  initialOverdue: boolean
}

/**
 * Live countdown on «Angefragt» ride cards (M15, #171, concept §2.1/§3.3).
 *
 * Shows the remaining time until the next SLA deadline («⏱ 18h»). The deadline
 * itself is computed SERVER-side via the shared `nextDeadline` function (single
 * source of truth with the cron engine, #165) and shipped as an absolute
 * instant — the client only renders the delta, so UI and escalation always
 * agree. When the deadline passes without a reload the badge flips to
 * «Überfällig» instead of counting into negative time.
 *
 * Hydration: the remaining time is only computed after mount (`remainingMs`
 * starts null); until then the server-provided `initialOverdue` decides which
 * badge shape renders. This keeps SSR and first client render identical.
 */
export function AcceptanceCountdown({
  dueAt,
  nextStage,
  initialOverdue,
}: AcceptanceCountdownProps) {
  const [remainingMs, setRemainingMs] = useState<number | null>(null)

  useEffect(() => {
    if (!dueAt) return
    const dueMs = new Date(dueAt).getTime()
    const update = () => setRemainingMs(dueMs - Date.now())
    update()
    const interval = setInterval(update, TICK_MS)
    return () => clearInterval(interval)
  }, [dueAt])

  // No pending deadline: either already escalated (timed_out → «Überfällig»)
  // or there is no active tracking at all (nothing to show).
  if (!dueAt) {
    return initialOverdue ? <OverdueBadge /> : null
  }

  const overdue = remainingMs !== null ? remainingMs <= 0 : initialOverdue
  if (overdue) {
    return <OverdueBadge />
  }

  const title = nextStage
    ? `Frist bis ${deadlineStageLabel(nextStage)}: ${new Date(
        dueAt
      ).toLocaleString("de-CH", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })}`
    : undefined

  return (
    <Badge
      variant="outline"
      className="border-amber-300 bg-amber-50 tabular-nums text-amber-800"
      title={title}
      aria-label={
        remainingMs !== null
          ? `Antwortfrist: noch ${formatRemaining(remainingMs)}`
          : "Antwortfrist läuft"
      }
    >
      <Timer className="mr-1 h-3 w-3" aria-hidden="true" />
      {remainingMs !== null ? formatRemaining(remainingMs) : "…"}
    </Badge>
  )
}

/** «Überfällig» marker — deadline passed or already escalated (concept §3.3). */
function OverdueBadge() {
  return (
    <Badge variant="outline" className="border-red-300 bg-red-50 text-red-700">
      <AlertTriangle className="mr-1 h-3 w-3" aria-hidden="true" />
      Überfällig
    </Badge>
  )
}
