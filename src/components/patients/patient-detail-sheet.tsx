"use client"

import Link from "next/link"
import { MapPin, Phone, ShieldAlert, MessageSquare, StickyNote } from "lucide-react"
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

const IMPAIRMENT_LABELS: Record<string, string> = {
  rollator: "Rollator",
  wheelchair: "Rollstuhl",
  stretcher: "Liegendtransport",
  companion: "Begleitperson",
}

type PatientWithImpairments = Tables<"patients"> & {
  patient_impairments: Tables<"patient_impairments">[]
}

interface PatientDetailSheetProps {
  patient: PatientWithImpairments | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onToggleActive: (id: string, currentActive: boolean) => void
  isPending: boolean
}

export function PatientDetailSheet({
  patient,
  open,
  onOpenChange,
  onToggleActive,
  isPending,
}: PatientDetailSheetProps) {
  if (!patient) return null

  const fullName = `${patient.last_name}, ${patient.first_name}`

  const address = [
    patient.street && patient.house_number
      ? `${patient.street} ${patient.house_number}`
      : patient.street,
    patient.postal_code && patient.city
      ? `${patient.postal_code} ${patient.city}`
      : patient.city,
  ]
    .filter(Boolean)
    .join(", ")

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const hasCoords = patient.lat != null && patient.lng != null && apiKey

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[480px] flex flex-col">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <SheetTitle>{fullName}</SheetTitle>
            <ActiveBadge isActive={patient.is_active} />
          </div>
          <SheetDescription className="sr-only">
            Details zu {fullName}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/patients/${patient.id}/edit`}>
              Bearbeiten
            </Link>
          </Button>

          <Separator />

          {/* Phone */}
          {patient.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{patient.phone}</span>
            </div>
          )}

          {/* Address */}
          {address && (
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{address}</span>
            </div>
          )}

          {/* Emergency contact */}
          {patient.emergency_contact_name && (
            <div className="flex items-start gap-2 text-sm">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-medium">Notfallkontakt</p>
                <p>{patient.emergency_contact_name}</p>
                {patient.emergency_contact_phone && (
                  <p>{patient.emergency_contact_phone}</p>
                )}
              </div>
            </div>
          )}

          {/* Impairments */}
          {patient.patient_impairments.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="mb-2 text-sm font-medium">Beeintraechtigungen</p>
                <div className="flex flex-wrap gap-1">
                  {patient.patient_impairments.map((pi) => (
                    <Badge key={pi.id} variant="outline">
                      {IMPAIRMENT_LABELS[pi.impairment_type] ?? pi.impairment_type}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Comment */}
          {patient.comment && (
            <>
              <Separator />
              <div className="flex items-start gap-2 text-sm">
                <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-medium">Kommentar</p>
                  <p className="whitespace-pre-wrap">{patient.comment}</p>
                </div>
              </div>
            </>
          )}

          {/* Notes */}
          {patient.notes && (
            <div className="flex items-start gap-2 text-sm">
              <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-medium">Notizen</p>
                <p className="whitespace-pre-wrap">{patient.notes}</p>
              </div>
            </div>
          )}

          {/* Map */}
          {hasCoords && (
            <>
              <Separator />
              <iframe
                className="h-[200px] w-full rounded-md border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${patient.lat},${patient.lng}&zoom=15`}
                title={`Karte: ${fullName}`}
                allowFullScreen
              />
            </>
          )}
        </div>

        <SheetFooter>
          <DeactivateDialog
            isActive={patient.is_active}
            entityLabel={fullName}
            isPending={isPending}
            onConfirm={() => {
              onToggleActive(patient.id, patient.is_active)
              onOpenChange(false)
            }}
          />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
