import { ArrowDown, ArrowUp, Minus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { formatDeltaPct, type Delta } from "@/lib/finance/dashboard"

interface DashboardKpiCardProps {
  label: string
  /** Preformatted current value (e.g. "CHF 1'234.50", "1'234", "1'234.5 km"). */
  value: string
  vsPreviousMonth: Delta
  vsPreviousYear: Delta
}

/**
 * A single KPI tile: label, current-month value, and two comparison deltas
 * (previous month, previous-year month). Direction is encoded with an icon +
 * color AND the signed percentage text, so it is never color-only (a11y).
 */
export function DashboardKpiCard({
  label,
  value,
  vsPreviousMonth,
  vsPreviousYear,
}: DashboardKpiCardProps) {
  return (
    <Card className="p-4 sm:p-5">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
        {value}
      </p>
      <dl className="mt-3 space-y-1">
        <DeltaRow term="vs. Vormonat" delta={vsPreviousMonth} />
        <DeltaRow term="vs. Vorjahr" delta={vsPreviousYear} />
      </dl>
    </Card>
  )
}

function DeltaRow({ term, delta }: { term: string; delta: Delta }) {
  const isNeutral = delta.pct === null || delta.direction === "flat"
  const Icon =
    delta.direction === "up"
      ? ArrowUp
      : delta.direction === "down"
        ? ArrowDown
        : Minus

  // Neutral / not-comparable → muted. Up → green, down → red (functional, not
  // decorative). "More km/revenue/rides" is always framed as positive.
  const toneClass = isNeutral
    ? "text-muted-foreground"
    : delta.direction === "up"
      ? "text-green-700"
      : "text-red-700"

  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <dt className="text-muted-foreground">{term}</dt>
      <dd
        className={cn("flex items-center gap-1 font-medium tabular-nums", toneClass)}
      >
        <Icon className="h-3 w-3" aria-hidden="true" />
        {formatDeltaPct(delta)}
      </dd>
    </div>
  )
}
