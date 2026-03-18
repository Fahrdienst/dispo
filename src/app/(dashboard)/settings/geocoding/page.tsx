import type { Metadata } from "next"
import { PageHeader } from "@/components/dashboard/page-header"
import { SettingsNav } from "@/components/settings/settings-nav"
import { Breadcrumb } from "@/components/shared/breadcrumb"
import { RetryGeocodingCard } from "@/components/settings/retry-geocoding-card"
import { MapsHealthDashboard } from "@/components/settings/maps-health-dashboard"

export const metadata: Metadata = {
  title: "Geocoding - Dispo",
}

export default function GeocodingSettingsPage() {
  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Einstellungen", href: "/settings/zones" },
          { label: "Geocoding" },
        ]}
      />
      <PageHeader
        title="Geocoding"
        description="Verwaltung der Adress-Geocodierung fuer Patienten und Ziele."
      />
      <SettingsNav />
      <MapsHealthDashboard />
      <RetryGeocodingCard />
    </div>
  )
}
