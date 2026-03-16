import type { Metadata } from "next"
import { DriverForm } from "@/components/drivers/driver-form"
import { Breadcrumb } from "@/components/shared/breadcrumb"

export const metadata: Metadata = {
  title: "Neuer Fahrer - Dispo",
}

export default function NewDriverPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Breadcrumb
        items={[
          { label: "Fahrer", href: "/drivers" },
          { label: "Neuer Fahrer" },
        ]}
      />
      <DriverForm />
    </div>
  )
}
