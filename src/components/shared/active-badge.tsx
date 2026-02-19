import { cn } from "@/lib/utils"

interface ActiveBadgeProps {
  isActive: boolean
  className?: string
}

export function ActiveBadge({ isActive, className }: ActiveBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
        isActive
          ? "bg-green-100 text-green-800"
          : "bg-gray-100 text-gray-500",
        className
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          isActive ? "bg-green-600" : "bg-gray-400"
        )}
        aria-hidden="true"
      />
      {isActive ? "Aktiv" : "Inaktiv"}
    </span>
  )
}
