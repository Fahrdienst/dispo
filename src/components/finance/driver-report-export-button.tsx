"use client"

import { useState, useTransition } from "react"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { exportDriverReportCsv } from "@/actions/driver-report"

interface DriverReportExportButtonProps {
  dateFrom: string
  dateTo: string
  /** Whether there is any data to export (disables the button when false). */
  disabled?: boolean
}

/**
 * Triggers the aggregate CSV export via the (owned) server action and downloads
 * the result client-side. The action audits the export (SEC-M14-006) and only
 * emits aggregate columns (SEC-M14-009).
 */
export function DriverReportExportButton({
  dateFrom,
  dateTo,
  disabled = false,
}: DriverReportExportButtonProps): React.ReactElement {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleExport(): void {
    setError(null)
    startTransition(async () => {
      const result = await exportDriverReportCsv(dateFrom, dateTo)
      if (!result.success) {
        setError(result.error ?? "Export fehlgeschlagen.")
        return
      }

      const blob = new Blob([result.data.csv], {
        type: "text/csv;charset=utf-8",
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = result.data.filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        onClick={handleExport}
        disabled={disabled || isPending}
      >
        <Download className="mr-1.5 h-4 w-4" />
        {isPending ? "Exportiere…" : "CSV Export"}
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
