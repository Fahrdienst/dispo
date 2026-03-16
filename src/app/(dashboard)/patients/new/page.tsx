import type { Metadata } from "next"
import { PatientForm } from "@/components/patients/patient-form"
import { Breadcrumb } from "@/components/shared/breadcrumb"

export const metadata: Metadata = {
  title: "Neuer Patient - Dispo",
}

export default function NewPatientPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Breadcrumb
        items={[
          { label: "Patienten", href: "/patients" },
          { label: "Neuer Patient" },
        ]}
      />
      <PatientForm />
    </div>
  )
}
