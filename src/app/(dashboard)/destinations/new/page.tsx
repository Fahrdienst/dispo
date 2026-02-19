import type { Metadata } from "next"
import { DestinationForm } from "@/components/destinations/destination-form"

export const metadata: Metadata = {
  title: "Neues Ziel - Dispo",
}

export default function NewDestinationPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <DestinationForm />
    </div>
  )
}
