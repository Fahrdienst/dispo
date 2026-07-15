import Link from "next/link"
import { FileText } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import {
  formatChf,
  formatDateShort,
  type PatientReceiptRow,
} from "@/lib/patients/rides-receipts"

interface PatientReceiptsListProps {
  receipts: PatientReceiptRow[]
}

const RECEIPT_STATUS_LABELS = {
  issued: "Ausgestellt",
  cancelled: "Storniert",
} as const

/**
 * Read-only list of the patient's receipts (Nummer, Zeitraum, Betrag, Status).
 * Each row links to the receipt list in the finance area (highlighted via
 * ?created=), where PDF download and storno live.
 */
export function PatientReceiptsList({ receipts }: PatientReceiptsListProps) {
  if (receipts.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
        Für diesen Patienten wurden noch keine Quittungen ausgestellt.
      </p>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nummer</TableHead>
            <TableHead>Zeitraum</TableHead>
            <TableHead className="text-right">Betrag</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[80px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {receipts.map((receipt) => {
            const isCancelled = receipt.status === "cancelled"
            return (
              <TableRow
                key={receipt.id}
                className={cn(isCancelled && "text-muted-foreground")}
              >
                <TableCell className="whitespace-nowrap font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <FileText
                      className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    {receipt.receiptNumber}
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatDateShort(receipt.periodFrom)} &ndash;{" "}
                  {formatDateShort(receipt.periodTo)}
                </TableCell>
                <TableCell
                  className={cn(
                    "whitespace-nowrap text-right",
                    isCancelled && "line-through"
                  )}
                >
                  {formatChf(receipt.totalAmount)}
                </TableCell>
                <TableCell>
                  <span
                    role="status"
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
                      isCancelled
                        ? "bg-slate-100 text-slate-700"
                        : "bg-green-100 text-green-800"
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        isCancelled ? "bg-slate-400" : "bg-green-600"
                      )}
                      aria-hidden="true"
                    />
                    {RECEIPT_STATUS_LABELS[receipt.status]}
                  </span>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/finance/receipts?year=${receipt.receiptNumber.split("-")[1]}&created=${receipt.id}`}
                    className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                  >
                    Öffnen
                  </Link>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
