"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { ACCEPTANCE_STAGE_LABELS } from "@/lib/acceptance/constants"
import type { AcceptanceStage } from "@/lib/acceptance/types"

const STAGE_COLORS: Record<AcceptanceStage, string> = {
  notified: "bg-blue-100 text-blue-800 border-blue-200",
  reminder_1: "bg-amber-100 text-amber-800 border-amber-200",
  reminder_2: "bg-orange-100 text-orange-800 border-orange-200",
  timed_out: "bg-red-100 text-red-800 border-red-200",
  confirmed: "bg-green-100 text-green-800 border-green-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
  cancelled: "bg-gray-100 text-gray-800 border-gray-200",
}

interface AcceptanceStageBadgeProps {
  stage: AcceptanceStage
  className?: string
}

export function AcceptanceStageBadge({ stage, className }: AcceptanceStageBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(STAGE_COLORS[stage], className)}
    >
      {ACCEPTANCE_STAGE_LABELS[stage]}
    </Badge>
  )
}
