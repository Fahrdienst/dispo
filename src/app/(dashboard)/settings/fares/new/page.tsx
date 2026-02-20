import type { Metadata } from "next"
import { FareVersionForm } from "@/components/fares/fare-version-form"

export const metadata: Metadata = {
  title: "Neue Tarifversion - Dispo",
}

export default function NewFareVersionPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <FareVersionForm />
    </div>
  )
}
