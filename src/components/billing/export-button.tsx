"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

interface ExportButtonProps {
  dateFrom: string
  dateTo: string
}

export function ExportButton({ dateFrom, dateTo }: ExportButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  async function handleExport(): Promise<void> {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        dateFrom,
        dateTo,
      })

      const response = await fetch(`/api/export/billing?${params.toString()}`)

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string }
        console.error("Export failed:", errorData.error ?? "Unknown error")
        return
      }

      // Download the CSV
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `verrechnung_${dateFrom}_${dateTo}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err: unknown) {
      console.error("Export error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      onClick={handleExport}
      disabled={isLoading}
    >
      {isLoading ? "Exportiere..." : "CSV Export"}
    </Button>
  )
}
