import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth/require-auth"
import {
  getSystemHealth,
  getSystemInfo,
  getEnvVarStatus,
  type ServiceStatus,
} from "@/actions/system"
import { CheckCircle2, XCircle, AlertTriangle, MinusCircle } from "lucide-react"
import { PageHeader } from "@/components/dashboard/page-header"
import { SettingsNav } from "@/components/settings/settings-nav"

// =============================================================================
// STATUS ICON
// =============================================================================

function StatusIcon({ status }: { status: ServiceStatus }) {
  switch (status) {
    case "healthy":
      return <CheckCircle2 className="h-5 w-5 text-emerald-500" />
    case "degraded":
      return <AlertTriangle className="h-5 w-5 text-amber-500" />
    case "unavailable":
      return <XCircle className="h-5 w-5 text-red-500" />
    case "not_configured":
      return <MinusCircle className="h-5 w-5 text-slate-400" />
  }
}

// =============================================================================
// CATEGORY LABELS
// =============================================================================

const categoryLabels: Record<string, string> = {
  required: "Pflicht",
  maps: "Google Maps",
  sms: "SMS",
  email: "E-Mail (SMTP)",
  redis: "Redis (Upstash)",
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default async function SystemPage() {
  const auth = await requireAuth(["admin"])
  if (!auth.authorized) {
    redirect("/login")
  }

  const [services, systemInfo, envVars] = await Promise.all([
    getSystemHealth(),
    getSystemInfo(),
    getEnvVarStatus(),
  ])

  const envVarsByCategory = envVars.reduce(
    (acc, v) => {
      const cat = v.category
      if (!acc[cat]) acc[cat] = []
      acc[cat]!.push(v)
      return acc
    },
    {} as Record<string, typeof envVars>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Einstellungen"
        description="Status der externen Dienste und Systemkonfiguration"
      />
      <SettingsNav />

      {/* System Info */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "App-Version", value: systemInfo.appVersion },
          { label: "Node.js", value: systemInfo.nodeVersion },
          { label: "Next.js", value: systemInfo.nextVersion },
          { label: "Umgebung", value: systemInfo.environment },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              {item.label}
            </p>
            <p className="mt-1 font-mono text-lg font-semibold">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Service Health */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-semibold">Dienste-Status</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {services.map((service) => (
            <div
              key={service.name}
              className="flex items-center justify-between px-6 py-3"
            >
              <div className="flex items-center gap-3">
                <StatusIcon status={service.status} />
                <div>
                  <p className="text-sm font-medium">{service.name}</p>
                  <p className="text-xs text-slate-500">{service.message}</p>
                </div>
              </div>
              {service.latencyMs !== undefined && (
                <span className="font-mono text-xs text-slate-400">
                  {service.latencyMs}ms
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Environment Variables */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-semibold">Umgebungsvariablen</h2>
          <p className="text-xs text-slate-500">
            Konfigurationsstatus (keine Werte angezeigt)
          </p>
        </div>
        <div className="divide-y divide-slate-100 px-6">
          {Object.entries(envVarsByCategory).map(([category, vars]) => (
            <div key={category} className="py-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {categoryLabels[category] || category}
              </h3>
              <div className="space-y-1">
                {vars.map((v) => (
                  <div
                    key={v.name}
                    className="flex items-center justify-between py-1"
                  >
                    <code className="text-sm text-slate-700">{v.name}</code>
                    {v.configured ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Konfiguriert
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <XCircle className="h-3.5 w-3.5" />
                        Nicht gesetzt
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
