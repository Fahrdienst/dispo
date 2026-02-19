import { cn } from "@/lib/utils"
import {
  RIDE_STATUS_LABELS,
  RIDE_STATUS_COLORS,
  RIDE_STATUS_DOT_COLORS,
} from "@/lib/rides/constants"
import type { Enums } from "@/lib/types/database"

interface RideStatusBadgeProps {
  status: Enums<"ride_status">
  className?: string
}

export function RideStatusBadge({ status, className }: RideStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
        RIDE_STATUS_COLORS[status],
        className
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 shrink-0 rounded-full", RIDE_STATUS_DOT_COLORS[status])}
        aria-hidden="true"
      />
      {RIDE_STATUS_LABELS[status]}
    </span>
  )
}
