import type { Metadata } from "next"
import { DriverForm } from "@/components/drivers/driver-form"

export const metadata: Metadata = {
  title: "Neuer Fahrer - Dispo",
}

export default function NewDriverPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <DriverForm />
    </div>
  )
}
