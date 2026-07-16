import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth/require-auth"
import { getDashboardData } from "@/lib/finance/dashboard-data"
import { formatChf, formatInt, formatKm } from "@/lib/finance/dashboard"
import { DashboardKpiCard } from "@/components/finance/dashboard-kpi-card"
import { DashboardBarChart } from "@/components/finance/dashboard-bar-chart"
import { DashboardTopList } from "@/components/finance/dashboard-top-list"
import { DashboardReceiptsWidget } from "@/components/finance/dashboard-receipts-widget"
import { Card, CardContent } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Finanzen - Dispo",
}

// Muted, single-accent-per-chart palette (design-system status hues).
const COLOR_REVENUE = "#334155" // slate-700
const COLOR_KM = "#0d9488" // teal-600
const COLOR_RIDES = "#6366f1" // indigo-500

/** Long German month label, e.g. "Juli 2026". */
function formatMonthTitle(monthStart: string): string {
  return new Date(`${monthStart}T00:00:00`).toLocaleDateString("de-CH", {
    month: "long",
    year: "numeric",
  })
}

export default async function FinanceDashboardPage(): Promise<React.ReactElement> {
  // Defense-in-depth: the /finance layout already gates admin+operator.
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    redirect("/login")
  }

  const data = await getDashboardData()
  const { kpis, chart, currentMonth, currentYear } = data

  const revenueChart = chart.map((point) => ({
    label: point.label,
    value: point.revenue,
    secondary: point.priorYearRevenue,
  }))
  const kmChart = chart.map((point) => ({ label: point.label, value: point.km }))
  const ridesChart = chart.map((point) => ({
    label: point.label,
    value: point.rideCount,
  }))

  return (
    <div className="space-y-8">
      {/* KPIs */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Kennzahlen</h2>
          <p className="text-sm text-muted-foreground">
            {formatMonthTitle(currentMonth)} · Vergleich zu Vormonat und
            Vorjahresmonat
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardKpiCard
            label="Umsatz"
            value={`CHF ${formatChf(kpis.revenue.value)}`}
            vsPreviousMonth={kpis.revenue.vsPreviousMonth}
            vsPreviousYear={kpis.revenue.vsPreviousYear}
          />
          <DashboardKpiCard
            label="Fahrten"
            value={formatInt(kpis.rides.value)}
            vsPreviousMonth={kpis.rides.vsPreviousMonth}
            vsPreviousYear={kpis.rides.vsPreviousYear}
          />
          <DashboardKpiCard
            label="Gefahrene km"
            value={`${formatKm(kpis.km.value)} km`}
            vsPreviousMonth={kpis.km.vsPreviousMonth}
            vsPreviousYear={kpis.km.vsPreviousYear}
          />
          <DashboardKpiCard
            label="Ø Preis pro Fahrt"
            value={`CHF ${formatChf(kpis.avgPrice.value)}`}
            vsPreviousMonth={kpis.avgPrice.vsPreviousMonth}
            vsPreviousYear={kpis.avgPrice.vsPreviousYear}
          />
        </div>
      </section>

      {/* Trends */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Verlauf (12 Monate)
        </h2>
        <Card>
          <CardContent className="p-4 sm:p-5">
            <DashboardBarChart
              title="Umsatzverlauf"
              data={revenueChart}
              formatValue={(v) => `CHF ${formatChf(v)}`}
              color={COLOR_REVENUE}
              seriesLabel="Aktuell"
              secondaryLabel="Vorjahr"
            />
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardContent className="p-4 sm:p-5">
              <DashboardBarChart
                title="Gefahrene km"
                data={kmChart}
                formatValue={(v) => `${formatKm(v)} km`}
                color={COLOR_KM}
                seriesLabel="km"
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 sm:p-5">
              <DashboardBarChart
                title="Fahrten"
                data={ridesChart}
                formatValue={(v) => formatInt(v)}
                color={COLOR_RIDES}
                seriesLabel="Fahrten"
              />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Top lists + receipts */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Top-Listen & Quittungen
          </h2>
          <p className="text-sm text-muted-foreground">
            Top-Listen: laufendes Jahr {currentYear}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DashboardTopList
            title="Häufigste Ziele"
            countLabel="Fahrten"
            items={data.topDestinations}
            emptyMessage="Noch keine abgeschlossenen Fahrten in diesem Jahr."
          />
          <DashboardTopList
            title="Patienten nach Fahrten"
            countLabel="Fahrten"
            items={data.topPatients}
            emptyMessage="Noch keine abgeschlossenen Fahrten in diesem Jahr."
          />
          <DashboardTopList
            title="Aktivste Fahrer"
            countLabel="Fahrten"
            items={data.topDrivers}
            emptyMessage="Noch keine zugewiesenen Fahrten in diesem Jahr."
          />
          <DashboardReceiptsWidget
            receipts={data.recentReceipts}
            receivableThisMonth={data.receivableThisMonth}
          />
        </div>
      </section>
    </div>
  )
}
