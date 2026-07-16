import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatInt, type TopListItem } from "@/lib/finance/dashboard"

interface DashboardTopListProps {
  title: string
  /** Column header for the counted unit, e.g. "Fahrten". */
  countLabel: string
  items: TopListItem[]
  /** Message when the list is empty. */
  emptyMessage: string
}

/**
 * A compact ranked list (top 5) for the dashboard: rank, label, and count.
 * Used for destinations, patients, and drivers over the running year.
 */
export function DashboardTopList({
  title,
  countLabel,
  items,
  emptyMessage,
}: DashboardTopListProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {items.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <ol className="space-y-1">
            {items.map((item, index) => (
              <li
                key={item.id}
                className="flex items-center gap-3 py-1 text-sm"
              >
                <span className="w-4 shrink-0 text-right font-medium tabular-nums text-muted-foreground">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-slate-900" title={item.label}>
                  {item.label}
                </span>
                <span className="shrink-0 tabular-nums font-medium text-slate-900">
                  {formatInt(item.count)}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    {countLabel}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
