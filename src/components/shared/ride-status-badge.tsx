import { cn } from "@/lib/utils"
import { RIDE_STATUS_LABELS, RIDE_STATUS_COLORS } from "@/lib/rides/constants"
import type { Enums } from "@/lib/types/database"

interface RideStatusBadgeProps {
  status: Enums<"ride_status">
}

export function RideStatusBadge({ status }: RideStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        RIDE_STATUS_COLORS[status]
      )}
    >
      {RIDE_STATUS_LABELS[status]}
    </span>
  )
}
