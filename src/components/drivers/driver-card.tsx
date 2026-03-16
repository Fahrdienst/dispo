"use client"

import { Car, Mail, Phone } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ActiveBadge } from "@/components/shared/active-badge"
import type { Tables } from "@/lib/types/database"

const vehicleTypeLabels: Record<string, string> = {
  standard: "Standard",
  wheelchair: "Rollstuhl",
  stretcher: "Trage",
}

const vehicleTypeAccent: Record<string, string> = {
  standard: "border-t-blue-500",
  wheelchair: "border-t-amber-500",
  stretcher: "border-t-red-500",
}

const vehicleTypeBadgeColors: Record<string, string> = {
  standard: "bg-blue-100 text-blue-800",
  wheelchair: "bg-amber-100 text-amber-800",
  stretcher: "bg-red-100 text-red-800",
}

interface DriverCardProps {
  driver: Tables<"drivers">
  onClick: () => void
}

export function DriverCard({ driver, onClick }: DriverCardProps) {
  return (
    <Card
      className={cn(
        "cursor-pointer border-t-4 transition-shadow hover:shadow-md",
        vehicleTypeAccent[driver.vehicle_type] ?? "border-t-gray-300",
        !driver.is_active && "opacity-50"
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold leading-tight">
            {driver.last_name}, {driver.first_name}
          </h3>
          <ActiveBadge isActive={driver.is_active} />
        </div>
        <Badge
          variant="secondary"
          className={cn(
            "w-fit text-xs",
            vehicleTypeBadgeColors[driver.vehicle_type]
          )}
        >
          {vehicleTypeLabels[driver.vehicle_type] ?? driver.vehicle_type}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-1.5 text-sm text-muted-foreground">
        {driver.phone && (
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            <span>{driver.phone}</span>
          </div>
        )}
        {driver.email && (
          <div className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{driver.email}</span>
          </div>
        )}
        {driver.vehicle && (
          <div className="flex items-center gap-2">
            <Car className="h-3.5 w-3.5 shrink-0" />
            <span>{driver.vehicle}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
