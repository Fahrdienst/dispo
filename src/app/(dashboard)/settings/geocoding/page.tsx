import type { Metadata } from "next"
import { PageHeader } from "@/components/dashboard/page-header"
import { SettingsNav } from "@/components/settings/settings-nav"
import { RetryGeocodingCard } from "@/components/settings/retry-geocoding-card"

export const metadata: Metadata = {
  title: "Geocoding - Dispo",
}

export default function GeocodingSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Geocoding"
        description="Verwaltung der Adress-Geocodierung fuer Patienten und Ziele."
      />
      <SettingsNav />
      <RetryGeocodingCard />
    </div>
  )
}
