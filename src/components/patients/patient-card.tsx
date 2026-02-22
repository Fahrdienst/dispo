"use client"

import { MapPin, Phone, ShieldAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ActiveBadge } from "@/components/shared/active-badge"
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

interface PatientCardProps {
  patient: PatientWithImpairments
  onClick: () => void
}

export function PatientCard({ patient, onClick }: PatientCardProps) {
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

  return (
    <Card
      className={cn(
        "cursor-pointer transition-shadow hover:shadow-md",
        !patient.is_active && "opacity-50"
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold leading-tight">
            {patient.last_name}, {patient.first_name}
          </h3>
          <ActiveBadge isActive={patient.is_active} />
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5 text-sm text-muted-foreground">
        {address && (
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{address}</span>
          </div>
        )}
        {patient.phone && (
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            <span>{patient.phone}</span>
          </div>
        )}
        {patient.emergency_contact_name && (
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
            <span>
              {patient.emergency_contact_name}
              {patient.emergency_contact_phone && ` (${patient.emergency_contact_phone})`}
            </span>
          </div>
        )}
        {patient.patient_impairments.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {patient.patient_impairments.map((pi) => (
              <Badge key={pi.id} variant="outline" className="text-xs">
                {IMPAIRMENT_LABELS[pi.impairment_type] ?? pi.impairment_type}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
