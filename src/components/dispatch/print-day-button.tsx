"use client"

import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"

interface PrintDayButtonProps {
  /** Date in YYYY-MM-DD format */
  date: string
}

/**
 * Opens the printable day sheet in a new tab.
 */
export function PrintDayButton({ date }: PrintDayButtonProps) {
  function handleClick(): void {
    window.open(`/dispatch/print?date=${date}`, "_blank")
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick}>
      <Printer className="mr-2 h-4 w-4" />
      Tagesplan drucken
    </Button>
  )
}
