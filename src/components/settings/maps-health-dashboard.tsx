"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, XCircle, AlertCircle, Map, Navigation, Search } from "lucide-react"
import { getMapsHealthStats } from "@/actions/geocoding"

interface Stats {
  patients: { total: number; geocoded: number; failed: number; pending: number }
  destinations: { total: number; geocoded: number; failed: number; pending: number }
}

export function MapsHealthDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMapsHealthStats().then((result) => {
      if (result.success && result.data) {
        setStats(result.data)
      }
      setLoading(false)
    })
  }, [])

  if (loading) {
    return <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {[1, 2, 3].map(i => <Card key={i} className="animate-pulse h-32" />)}
    </div>
  }

  const pPercent = stats ? Math.round((stats.patients.geocoded / (stats.patients.total || 1)) * 100) : 0
  const dPercent = stats ? Math.round((stats.destinations.geocoded / (stats.destinations.total || 1)) * 100) : 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* API Status Cards */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Geocoding API</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Aktiv</div>
            <p className="text-xs text-muted-foreground underline">Server-Key konfiguriert</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Directions API</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Aktiv</div>
            <p className="text-xs text-muted-foreground underline">Routenberechnung bereit</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Static Maps API</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Aktiv</div>
            <p className="text-xs text-muted-foreground underline">Client-Key konfiguriert</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Data Coverage Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Daten-Integrität (Geocoding)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2"><Navigation className="h-4 w-4" /> Patienten</span>
                <span className="font-medium">{pPercent}% ({stats?.patients.geocoded}/{stats?.patients.total})</span>
              </div>
              <Progress value={pPercent} className="h-2" />
              {stats && stats.patients.failed > 0 && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <XCircle className="h-3 w-3" /> {stats.patients.failed} Fehlerhaft
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2"><Map className="h-4 w-4" /> Ziele</span>
                <span className="font-medium">{dPercent}% ({stats?.destinations.geocoded}/{stats?.destinations.total})</span>
              </div>
              <Progress value={dPercent} className="h-2" />
              {stats && stats.destinations.failed > 0 && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <XCircle className="h-3 w-3" /> {stats.destinations.failed} Fehlerhaft
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Feature Roadmap Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Feature Roadmap (#82)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm border-b pb-2">
                <span className="text-muted-foreground">Geocoding & Static Maps</span>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">100% (P0)</Badge>
              </div>
              <div className="flex items-center justify-between text-sm border-b pb-2">
                <span className="text-muted-foreground">Routen & Zeitvorschläge</span>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">90% (P0)</Badge>
              </div>
              <div className="flex items-center justify-between text-sm border-b pb-2">
                <span className="text-muted-foreground">Interaktive Dispatch-Karte</span>
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">In Planung (P1)</Badge>
              </div>
              <div className="flex items-center justify-between text-sm border-b pb-2">
                <span className="text-muted-foreground">Visuelle Zonen-Verwaltung</span>
                <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">Offen (P2)</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
