import type { Metadata } from "next"
import { PatientForm } from "@/components/patients/patient-form"

export const metadata: Metadata = {
  title: "Neuer Patient - Dispo",
}

export default function NewPatientPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PatientForm />
    </div>
  )
}
