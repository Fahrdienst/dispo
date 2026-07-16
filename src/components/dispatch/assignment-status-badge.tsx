import { cn } from "@/lib/utils"
import {
  ASSIGNMENT_STATUS_LABELS,
  ASSIGNMENT_STATUS_COLORS,
  ASSIGNMENT_STATUS_DOT_COLORS,
  type AssignmentStatus,
} from "@/lib/dispatch/assignment-status"

interface AssignmentStatusBadgeProps {
  status: AssignmentStatus
  className?: string
}

/**
 * Badge for the four split-view assignment buckets (M15, #168).
 *
 * Distinct from `RideStatusBadge` (which renders the full 10-value ride
 * lifecycle). Always shows dot + text — never color alone (accessibility,
 * concept §6).
 */
export function AssignmentStatusBadge({
  status,
  className,
}: AssignmentStatusBadgeProps) {
  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
        ASSIGNMENT_STATUS_COLORS[status],
        className
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          ASSIGNMENT_STATUS_DOT_COLORS[status]
        )}
        aria-hidden="true"
      />
      {ASSIGNMENT_STATUS_LABELS[status]}
    </span>
  )
}
