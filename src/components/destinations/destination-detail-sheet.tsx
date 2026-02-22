"use client"

import Link from "next/link"
import { MapPin, Phone, User, Building2, MessageSquare } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ActiveBadge } from "@/components/shared/active-badge"
import { DeactivateDialog } from "@/components/shared/deactivate-dialog"
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

interface DestinationDetailSheetProps {
  destination: Tables<"destinations"> | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onToggleActive: (id: string, currentActive: boolean) => void
  isPending: boolean
}

export function DestinationDetailSheet({
  destination,
  open,
  onOpenChange,
  onToggleActive,
  isPending,
}: DestinationDetailSheetProps) {
  if (!destination) return null

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

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const hasCoords = destination.lat != null && destination.lng != null && apiKey

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[480px] flex flex-col">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className={facilityTypeColors[destination.facility_type]}
            >
              {facilityTypeLabels[destination.facility_type] ?? destination.facility_type}
            </Badge>
            <ActiveBadge isActive={destination.is_active} />
          </div>
          <SheetTitle>{destination.display_name}</SheetTitle>
          <SheetDescription className="sr-only">
            Details zu {destination.display_name}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/destinations/${destination.id}/edit`}>
              Bearbeiten
            </Link>
          </Button>

          <Separator />

          {/* Address */}
          {address && (
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{address}</span>
            </div>
          )}

          {/* Phone */}
          {destination.contact_phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{destination.contact_phone}</span>
            </div>
          )}

          {/* Contact person */}
          {contact && (
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{contact}</span>
            </div>
          )}

          {/* Department */}
          {destination.department && (
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{destination.department}</span>
            </div>
          )}

          {/* Comment */}
          {destination.comment && (
            <>
              <Separator />
              <div className="flex items-start gap-2 text-sm">
                <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="whitespace-pre-wrap">{destination.comment}</p>
              </div>
            </>
          )}

          {/* Map */}
          {hasCoords && (
            <>
              <Separator />
              <iframe
                className="h-[200px] w-full rounded-md border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${destination.lat},${destination.lng}&zoom=15`}
                title={`Karte: ${destination.display_name}`}
                allowFullScreen
              />
            </>
          )}
        </div>

        <SheetFooter>
          <DeactivateDialog
            isActive={destination.is_active}
            entityLabel={destination.display_name}
            isPending={isPending}
            onConfirm={() => {
              onToggleActive(destination.id, destination.is_active)
              onOpenChange(false)
            }}
          />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
