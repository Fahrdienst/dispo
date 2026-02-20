import type { Metadata } from "next"
import { ZoneForm } from "@/components/zones/zone-form"

export const metadata: Metadata = {
  title: "Neue Zone - Dispo",
}

export default function NewZonePage() {
  return (
    <div className="mx-auto max-w-2xl">
      <ZoneForm />
    </div>
  )
}
