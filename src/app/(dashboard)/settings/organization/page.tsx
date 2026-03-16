import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth/require-auth"
import { getOrganizationSettings } from "@/actions/organization"
import { OrganizationSettingsForm } from "@/components/settings/organization-settings-form"
import { PageHeader } from "@/components/dashboard/page-header"
import { SettingsNav } from "@/components/settings/settings-nav"
import { Breadcrumb } from "@/components/shared/breadcrumb"

export default async function OrganizationSettingsPage() {
  const auth = await requireAuth(["admin"])
  if (!auth.authorized) {
    redirect("/login")
  }

  const settings = await getOrganizationSettings()

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Einstellungen", href: "/settings/zones" },
          { label: "Organisation" },
        ]}
      />
      <PageHeader
        title="Einstellungen"
        description="Organisationsdaten, Branding und Kommunikationseinstellungen"
      />
      <SettingsNav />
      <OrganizationSettingsForm settings={settings} />
    </div>
  )
}
