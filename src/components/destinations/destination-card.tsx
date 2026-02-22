"use client"

import { MapPin, Phone, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ActiveBadge } from "@/components/shared/active-badge"
import type { Tables } from "@/lib/types/database"

const facilityTypeLabels: Record<string, string> = {
  practice: "Praxis",
  hospital: "Spital",
  therapy_center: "Therapiezentrum",
  day_care: "Tagesheim",
  other: "Sonstiges",
}

const facilityTypeColors: Record<string, string> = {
  practice: "bg-blue-100 text-blue-800",
  hospital: "bg-red-100 text-red-800",
  therapy_center: "bg-purple-100 text-purple-800",
  day_care: "bg-amber-100 text-amber-800",
  other: "bg-gray-100 text-gray-800",
}

interface DestinationCardProps {
  destination: Tables<"destinations">
  onClick: () => void
}

export function DestinationCard({ destination, onClick }: DestinationCardProps) {
  const address = [
    destination.street && destination.house_number
      ? `${destination.street} ${destination.house_number}`
      : destination.street,
    destination.postal_code && destination.city
      ? `${destination.postal_code} ${destination.city}`
      : destination.city,
  ]
    .filter(Boolean)
    .join(", ")

  const contact = [destination.contact_first_name, destination.contact_last_name]
    .filter(Boolean)
    .join(" ")

  return (
    <Card
      className={cn(
        "cursor-pointer transition-shadow hover:shadow-md",
        !destination.is_active && "opacity-50"
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <Badge
            variant="secondary"
            className={cn(
              "text-xs",
              facilityTypeColors[destination.facility_type]
            )}
          >
            {facilityTypeLabels[destination.facility_type] ?? destination.facility_type}
          </Badge>
          <ActiveBadge isActive={destination.is_active} />
        </div>
        <h3 className="font-semibold leading-tight">{destination.display_name}</h3>
      </CardHeader>
      <CardContent className="space-y-1.5 text-sm text-muted-foreground">
        {address && (
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{address}</span>
          </div>
        )}
        {destination.contact_phone && (
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            <span>{destination.contact_phone}</span>
          </div>
        )}
        {contact && (
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 shrink-0" />
            <span>{contact}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
