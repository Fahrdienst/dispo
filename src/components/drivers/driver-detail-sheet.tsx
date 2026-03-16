"use client"

import Link from "next/link"
import {
  Car,
  IdCard,
  Mail,
  MapPin,
  Phone,
  ShieldAlert,
  StickyNote,
} from "lucide-react"
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
import { AnonymizeDialog } from "@/components/shared/anonymize-dialog"
import { anonymizeDriver } from "@/actions/gdpr"
import { cn } from "@/lib/utils"
import type { Tables, Enums } from "@/lib/types/database"

const vehicleTypeLabels: Record<string, string> = {
  standard: "Standard",
  wheelchair: "Rollstuhl",
  stretcher: "Trage",
}

const vehicleTypeBadgeColors: Record<string, string> = {
  standard: "bg-blue-100 text-blue-800",
  wheelchair: "bg-amber-100 text-amber-800",
  stretcher: "bg-red-100 text-red-800",
}

interface DriverDetailSheetProps {
  driver: Tables<"drivers"> | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onToggleActive: (id: string, currentActive: boolean) => void
  isPending: boolean
  userRole?: Enums<"user_role">
}

export function DriverDetailSheet({
  driver,
  open,
  onOpenChange,
  onToggleActive,
  isPending,
  userRole,
}: DriverDetailSheetProps) {
  if (!driver) return null

  const fullName = `${driver.last_name}, ${driver.first_name}`

  const address = [
    driver.street && driver.house_number
      ? `${driver.street} ${driver.house_number}`
      : driver.street,
    driver.postal_code && driver.city
      ? `${driver.postal_code} ${driver.city}`
      : driver.city,
  ]
    .filter(Boolean)
    .join(", ")

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[480px] flex flex-col">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <SheetTitle>{fullName}</SheetTitle>
            <ActiveBadge isActive={driver.is_active} />
          </div>
          <SheetDescription className="sr-only">
            Details zu {fullName}
          </SheetDescription>
          <Badge
            variant="secondary"
            className={cn(
              "w-fit text-xs",
              vehicleTypeBadgeColors[driver.vehicle_type]
            )}
          >
            {vehicleTypeLabels[driver.vehicle_type] ?? driver.vehicle_type}
          </Badge>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/drivers/${driver.id}/edit`}>Bearbeiten</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/drivers/${driver.id}/availability`}>
                Verfuegbarkeit
              </Link>
            </Button>
          </div>

          <Separator />

          {/* Phone */}
          {driver.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{driver.phone}</span>
            </div>
          )}

          {/* Email */}
          {driver.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{driver.email}</span>
            </div>
          )}

          {/* Address */}
          {address && (
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{address}</span>
            </div>
          )}

          {/* Vehicle */}
          {driver.vehicle && (
            <div className="flex items-center gap-2 text-sm">
              <Car className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-medium">Fahrzeug</p>
                <p>{driver.vehicle}</p>
              </div>
            </div>
          )}

          {/* Driving license */}
          {driver.driving_license && (
            <div className="flex items-center gap-2 text-sm">
              <IdCard className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-medium">Fuehrerschein</p>
                <p>{driver.driving_license}</p>
              </div>
            </div>
          )}

          {/* Emergency contact */}
          {driver.emergency_contact_name && (
            <>
              <Separator />
              <div className="flex items-start gap-2 text-sm">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-medium">Notfallkontakt</p>
                  <p>{driver.emergency_contact_name}</p>
                  {driver.emergency_contact_phone && (
                    <p>{driver.emergency_contact_phone}</p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Notes */}
          {driver.notes && (
            <>
              <Separator />
              <div className="flex items-start gap-2 text-sm">
                <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-medium">Notizen</p>
                  <p className="whitespace-pre-wrap">{driver.notes}</p>
                </div>
              </div>
            </>
          )}
        </div>

        <SheetFooter className="flex-col gap-2 sm:flex-col">
          <DeactivateDialog
            isActive={driver.is_active}
            entityLabel={fullName}
            isPending={isPending}
            onConfirm={() => {
              onToggleActive(driver.id, driver.is_active)
              onOpenChange(false)
            }}
          />
          {userRole === "admin" && driver.first_name !== "ANONYMISIERT" && (
            <AnonymizeDialog
              entityId={driver.id}
              entityLabel={fullName}
              onAnonymize={anonymizeDriver}
              onComplete={() => onOpenChange(false)}
            />
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
