"use client"

import { useState, useMemo, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Download, Mail, Ban, Loader2, AlertTriangle } from "lucide-react"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmptyState } from "@/components/shared/empty-state"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { getReceiptDownloadUrl } from "@/actions/receipt-download"
import { ReceiptListCancelDialog } from "@/components/finance/receipt-list-cancel-dialog"
import { ReceiptListEmailDialog } from "@/components/finance/receipt-list-email-dialog"

export interface ReceiptListRow {
  id: string
  receiptNumber: string
  recipientName: string
  patientId: string | null
  periodFrom: string
  periodTo: string
  totalAmount: number
  currency: string
  status: "issued" | "cancelled"
  issuedAt: string
  hasPdf: boolean
  recipientEmail: string | null
}

interface ReceiptListProps {
  receipts: ReceiptListRow[]
  years: number[]
  selectedYear: number
  /** Receipt id to highlight (freshly created, ?created=<id>). */
  highlightId?: string | null
}

type StatusFilter = "all" | "issued" | "cancelled"

/** Format a YYYY-MM-DD date as "DD.MM.YYYY". */
function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-")
  if (!y || !m || !d) return dateStr
  return `${d}.${m}.${y}`
}

/** Format a period; collapse a single-day period to one date. */
function formatPeriod(from: string, to: string): string {
  return from === to ? formatDate(from) : `${formatDate(from)} – ${formatDate(to)}`
}

/** Format an ISO timestamp as "DD.MM.YYYY". */
function formatIssuedAt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function formatMoney(amount: number, currency: string): string {
  return `${currency} ${amount.toFixed(2)}`
}

export function ReceiptList({
  receipts,
  years,
  selectedYear,
  highlightId,
}: ReceiptListProps) {
  const router = useRouter()

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [search, setSearch] = useState("")
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [, startDownload] = useTransition()

  const [cancelTarget, setCancelTarget] = useState<{
    id: string
    receiptNumber: string
  } | null>(null)
  const [emailTarget, setEmailTarget] = useState<{
    id: string
    receiptNumber: string
    recipientEmail: string
  } | null>(null)

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return receipts.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false
      if (!term) return true
      return (
        r.recipientName.toLowerCase().includes(term) ||
        r.receiptNumber.toLowerCase().includes(term)
      )
    })
  }, [receipts, statusFilter, search])

  function handleYearChange(value: string) {
    router.push(`/finance/receipts?year=${value}`)
  }

  function handleDownload(row: ReceiptListRow) {
    setDownloadingId(row.id)
    startDownload(async () => {
      const result = await getReceiptDownloadUrl(row.id)
      setDownloadingId(null)
      if (!result.success) {
        toast({
          title: "Download nicht möglich",
          description: result.error ?? "Der Beleg konnte nicht geladen werden.",
          variant: "destructive",
        })
        return
      }
      window.open(result.data.url, "_blank", "noopener,noreferrer")
    })
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="receipt-year">Jahr</Label>
            <Select value={String(selectedYear)} onValueChange={handleYearChange}>
              <SelectTrigger id="receipt-year" className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="receipt-status">Status</Label>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            >
              <SelectTrigger id="receipt-status" className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="issued">Ausgestellt</SelectItem>
                <SelectItem value="cancelled">Storniert</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="receipt-search">Suche</Label>
          <Input
            id="receipt-search"
            placeholder="Empfänger oder Nummer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:w-64"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="Keine Quittungen gefunden." />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nummer</TableHead>
                <TableHead>Empfänger</TableHead>
                <TableHead>Zeitraum</TableHead>
                <TableHead className="text-right">Betrag</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ausgestellt</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => {
                const isCancelled = row.status === "cancelled"
                const canEmail = !isCancelled && row.hasPdf && !!row.recipientEmail
                return (
                  <TableRow
                    key={row.id}
                    className={cn(
                      row.id === highlightId && "bg-primary/5",
                      isCancelled && "text-muted-foreground"
                    )}
                  >
                    <TableCell className="font-medium">
                      <span className="whitespace-nowrap">{row.receiptNumber}</span>
                      {!row.hasPdf && (
                        <span
                          className="ml-2 inline-flex items-center gap-1 text-xs text-amber-600"
                          title="Für diesen Beleg wurde noch kein PDF erzeugt."
                        >
                          <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                          kein PDF
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{row.recipientName}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatPeriod(row.periodFrom, row.periodTo)}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {formatMoney(row.totalAmount, row.currency)}
                    </TableCell>
                    <TableCell>
                      {isCancelled ? (
                        <Badge variant="destructive">Storniert</Badge>
                      ) : (
                        <Badge variant="secondary">Ausgestellt</Badge>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatIssuedAt(row.issuedAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={!row.hasPdf || downloadingId === row.id}
                          onClick={() => handleDownload(row)}
                          title={
                            row.hasPdf
                              ? "PDF herunterladen"
                              : "Kein PDF vorhanden"
                          }
                        >
                          {downloadingId === row.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <Download className="h-4 w-4" aria-hidden="true" />
                          )}
                          <span className="sr-only">Herunterladen</span>
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={!canEmail}
                          onClick={() =>
                            row.recipientEmail &&
                            setEmailTarget({
                              id: row.id,
                              receiptNumber: row.receiptNumber,
                              recipientEmail: row.recipientEmail,
                            })
                          }
                          title={
                            isCancelled
                              ? "Stornierte Belege können nicht versendet werden"
                              : !row.hasPdf
                                ? "Kein PDF vorhanden"
                                : !row.recipientEmail
                                  ? "Keine E-Mail-Adresse hinterlegt"
                                  : "Per E-Mail senden"
                          }
                        >
                          <Mail className="h-4 w-4" aria-hidden="true" />
                          <span className="sr-only">Per E-Mail senden</span>
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isCancelled}
                          onClick={() =>
                            setCancelTarget({
                              id: row.id,
                              receiptNumber: row.receiptNumber,
                            })
                          }
                          title={
                            isCancelled ? "Bereits storniert" : "Beleg stornieren"
                          }
                        >
                          <Ban className="h-4 w-4 text-destructive" aria-hidden="true" />
                          <span className="sr-only">Stornieren</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <ReceiptListCancelDialog
        target={cancelTarget}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null)
        }}
        onCancelled={() => {
          setCancelTarget(null)
          router.refresh()
        }}
      />

      <ReceiptListEmailDialog
        target={emailTarget}
        onOpenChange={(open) => {
          if (!open) setEmailTarget(null)
        }}
      />
    </div>
  )
}
