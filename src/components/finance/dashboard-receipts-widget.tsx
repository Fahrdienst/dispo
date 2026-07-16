import Link from "next/link"
import { ArrowRight, FileText, Inbox } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatChf, formatInt } from "@/lib/finance/dashboard"
import type { RecentReceipt } from "@/lib/finance/dashboard-data"

interface DashboardReceiptsWidgetProps {
  receipts: RecentReceipt[]
  /** Receivable rides (completed, priced, not yet on an active receipt) this month. */
  receivableThisMonth: number
}

/** Format an ISO timestamp as "DD.MM.YYYY" (de-CH). */
function formatIssuedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

/**
 * Dashboard receipts widget: the 5 most recently issued receipts (deep-linking
 * into the receipts list, highlighting the row) plus the current-month work
 * queue (receivable rides) linking straight to the batch run.
 */
export function DashboardReceiptsWidget({
  receipts,
  receivableThisMonth,
}: DashboardReceiptsWidgetProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Quittungen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {/* Work queue */}
        <Link
          href="/finance/receipts/batch"
          className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3 transition-colors hover:bg-muted"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Inbox className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-slate-900">
              {formatInt(receivableThisMonth)}{" "}
              {receivableThisMonth === 1
                ? "quittierbare Fahrt"
                : "quittierbare Fahrten"}{" "}
              diesen Monat
            </span>
            <span className="block text-xs text-muted-foreground">
              Zum Sammellauf
            </span>
          </span>
          <ArrowRight
            className="h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        </Link>

        {/* Recently issued */}
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Zuletzt ausgestellt
          </p>
          {receipts.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              Noch keine Quittungen ausgestellt.
            </p>
          ) : (
            <ul className="space-y-1">
              {receipts.map((receipt) => (
                <li key={receipt.id}>
                  <Link
                    href={`/finance/receipts?year=${receipt.year}&created=${receipt.id}`}
                    className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
                  >
                    <FileText
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="font-medium tabular-nums text-slate-900">
                          {receipt.receiptNumber}
                        </span>
                        {receipt.status === "cancelled" && (
                          <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">
                            Storniert
                          </Badge>
                        )}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {receipt.recipientName} · {formatIssuedAt(receipt.issuedAt)}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums text-sm font-medium text-slate-900">
                      {receipt.currency} {formatChf(receipt.totalAmount)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Link
          href="/finance/receipts"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Alle Quittungen
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </CardContent>
    </Card>
  )
}
