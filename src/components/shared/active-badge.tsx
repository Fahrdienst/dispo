import { Badge } from "@/components/ui/badge"

interface ActiveBadgeProps {
  isActive: boolean
}

export function ActiveBadge({ isActive }: ActiveBadgeProps) {
  return (
    <Badge variant={isActive ? "default" : "secondary"}>
      {isActive ? "Aktiv" : "Inaktiv"}
    </Badge>
  )
}
