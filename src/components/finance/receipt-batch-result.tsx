"use client"

import { useState } from "react"
import Link from "next/link"
import { Download, Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/hooks/use-toast"
import type { BatchRunResult, BatchRunOutcome } from "@/lib/receipts/batch-runner"

interface ReceiptBatchResultProps {
  result: BatchRunResult
  emailRequested: boolean
}

/** Human-readable label + tone for a per-patient mail outcome. */
function emailLabel(
  outcome: BatchRunOutcome,
  emailRequested: boolean
): { text: string; tone: "ok" | "muted" | "danger" } | null {
  if (!emailRequested || outcome.status !== "issued") return null
  switch (outcome.email) {
    case "sent":
      return { text: "E-Mail gesendet", tone: "ok" }
    case "no_email":
      return { text: "nur Druck (keine E-Mail)", tone: "muted" }
    case "failed":
      return { text: "E-Mail fehlgeschlagen", tone: "danger" }
    default:
      return null
  }
}

export function ReceiptBatchResult({
  result,
  emailRequested,
}: ReceiptBatchResultProps) {
  const [isDownloading, setIsDownloading] = useState(false)
  const { outcomes, issuedCount, failedCount, receiptIds } = result

  const pdfFailures = outcomes.filter(
    (o) => o.status === "issued" && !o.pdfGenerated
  ).length

  async function handleDownloadCollectivePdf() {
    if (receiptIds.length === 0) return
    setIsDownloading(true)
    try {
      const response = await fetch("/finance/receipts/batch/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: receiptIds }),
      })
      if (!response.ok) {
        toast({
          title: "Sammel-PDF nicht möglich",
          description: "Das Sammel-PDF konnte nicht erzeugt werden.",
          variant: "destructive",
        })
        return
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `Sammellauf-${new Date().toISOString().slice(0, 10)}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch {
      toast({
        title: "Sammel-PDF nicht möglich",
        description: "Der Download ist fehlgeschlagen. Bitte erneut versuchen.",
        variant: "destructive",
      })
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ergebnis des Sammellaufs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              {issuedCount} Quittung(en) ausgestellt
            </span>
            {failedCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-destructive">
                <XCircle className="h-4 w-4" aria-hidden="true" />
                {failedCount} fehlgeschlagen
              </span>
            )}
            {pdfFailures > 0 && (
              <span className="inline-flex items-center gap-1.5 text-amber-600">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                {pdfFailures} ohne PDF (später neu erzeugbar)
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={handleDownloadCollectivePdf}
              disabled={isDownloading || receiptIds.length === 0}
            >
              {isDownloading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Sammel-PDF herunterladen
            </Button>
            <Button asChild variant="outline">
              <Link href="/finance/receipts">Zur Quittungsliste</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Per-patient outcomes */}
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Patient</TableHead>
              <TableHead>Nummer</TableHead>
              <TableHead className="text-right">Fahrten</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {outcomes.map((o) => {
              const mail = emailLabel(o, emailRequested)
              return (
                <TableRow key={o.patientId}>
                  <TableCell className="font-medium">{o.patientName}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {o.receiptNumber ?? "–"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {o.rideCount}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {o.status === "issued" ? (
                        <Badge variant="secondary" className="w-fit">
                          Ausgestellt
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="w-fit">
                          Fehlgeschlagen
                        </Badge>
                      )}
                      {o.status === "issued" && !o.pdfGenerated && (
                        <span className="text-xs text-amber-600">
                          PDF fehlt (später neu erzeugbar)
                        </span>
                      )}
                      {o.status === "failed" && o.error && (
                        <span className="text-xs text-destructive">{o.error}</span>
                      )}
                      {mail && (
                        <span
                          className={
                            mail.tone === "ok"
                              ? "text-xs text-emerald-600"
                              : mail.tone === "danger"
                                ? "text-xs text-destructive"
                                : "text-xs text-muted-foreground"
                          }
                        >
                          {mail.text}
                          {o.email === "failed" && o.error ? `: ${o.error}` : ""}
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
