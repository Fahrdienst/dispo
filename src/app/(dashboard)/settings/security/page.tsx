import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth/require-auth"
import { getMFAStatus } from "@/actions/mfa"
import { MfaSettings } from "@/components/settings/mfa-settings"
import { PageHeader } from "@/components/dashboard/page-header"
import { SettingsNav } from "@/components/settings/settings-nav"
import { Breadcrumb } from "@/components/shared/breadcrumb"

export default async function SecuritySettingsPage() {
  const auth = await requireAuth()
  if (!auth.authorized) {
    redirect("/login")
  }

  const mfaResult = await getMFAStatus()
  const mfaEnabled = mfaResult.success ? mfaResult.data.enabled : false
  const mfaFactorId = mfaResult.success ? mfaResult.data.factorId : null

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Einstellungen", href: "/settings/zones" },
          { label: "Sicherheit" },
        ]}
      />
      <PageHeader
        title="Einstellungen"
        description="Sicherheitseinstellungen und Zwei-Faktor-Authentifizierung"
      />
      <SettingsNav />
      <MfaSettings initialEnabled={mfaEnabled} initialFactorId={mfaFactorId} />
    </div>
  )
}
