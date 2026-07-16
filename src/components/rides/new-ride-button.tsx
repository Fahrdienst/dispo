import Link from "next/link"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

interface NewRideButtonProps {
  /** Pre-fill the appointment date on the capture page (?date=). */
  defaultDate?: string
  className?: string
}

/**
 * Primary entry point for creating a ride: links to the one-page dispatch
 * capture (`/rides/erfassen`, Milestone M13). Replaced the quick-capture modal
 * as the default "Neue Fahrt" action across the dashboard and dispatch board.
 */
export function NewRideButton({ defaultDate, className }: NewRideButtonProps) {
  const href = defaultDate
    ? `/rides/erfassen?date=${encodeURIComponent(defaultDate)}`
    : "/rides/erfassen"
  return (
    <Button asChild className={className}>
      <Link href={href}>
        <Plus className="h-4 w-4" />
        Neue Fahrt
      </Link>
    </Button>
  )
}
