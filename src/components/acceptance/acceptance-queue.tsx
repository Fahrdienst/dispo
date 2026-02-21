"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AcceptanceStageBadge } from "./acceptance-stage-badge"
import { ACTIVE_STAGES } from "@/lib/acceptance/constants"
import type { AcceptanceStage } from "@/lib/acceptance/types"
import type { Enums } from "@/lib/types/database"

export interface QueueEntry {
  tracking_id: string
  ride_id: string
  driver_name: string
  patient_name: string
  destination_name: string
  pickup_time: string
  date: string
  direction: Enums<"ride_direction">
  stage: AcceptanceStage
  notified_at: string
  rejection_reason_code: string | null
  rejection_reason_text: string | null
}

type FilterTab = "waiting" | "reminded" | "timeout" | "rejected"

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "waiting", label: "Wartend" },
  { key: "reminded", label: "Erinnert" },
  { key: "timeout", label: "Timeout" },
  { key: "rejected", label: "Abgelehnt" },
]

function matchesFilter(entry: QueueEntry, filter: FilterTab): boolean {
  switch (filter) {
    case "waiting":
      return entry.stage === "notified"
    case "reminded":
      return entry.stage === "reminder_1" || entry.stage === "reminder_2"
    case "timeout":
      return entry.stage === "timed_out"
    case "rejected":
      return entry.stage === "rejected"
  }
}

function formatTimeSince(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime()
  const minutes = Math.floor(diffMs / (1000 * 60))
  if (minutes < 1) return "gerade eben"
  if (minutes < 60) return `vor ${minutes} Min.`
  const hours = Math.floor(minutes / 60)
  return `vor ${hours} Std.`
}

interface AcceptanceQueueProps {
  entries: QueueEntry[]
  onReassign?: (rideId: string) => void
}

export function AcceptanceQueue({ entries, onReassign }: AcceptanceQueueProps) {
  const [activeFilter, setActiveFilter] = useState<FilterTab>("waiting")

  // Count active (non-terminal) entries for the header
  const activeCount = entries.filter((e) =>
    (ACTIVE_STAGES as readonly string[]).includes(e.stage)
  ).length

  if (entries.length === 0) return null

  const filteredEntries = entries.filter((e) => matchesFilter(e, activeFilter))

  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
            {activeCount}
          </span>
          Wartend auf Antwort
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Filter tabs */}
        <div className="mb-4 flex gap-1">
          {FILTER_TABS.map((tab) => {
            const count = entries.filter((e) =>
              matchesFilter(e, tab.key)
            ).length
            return (
              <Button
                key={tab.key}
                variant={activeFilter === tab.key ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveFilter(tab.key)}
                className="text-xs"
              >
                {tab.label}
                {count > 0 && (
                  <span className="ml-1 text-xs opacity-70">({count})</span>
                )}
              </Button>
            )
          })}
        </div>

        {/* Entries */}
        {filteredEntries.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            Keine Eintraege in dieser Kategorie.
          </p>
        ) : (
          <div className="space-y-2">
            {filteredEntries.map((entry) => (
              <div
                key={entry.tracking_id}
                className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold">
                      {entry.pickup_time.slice(0, 5)}
                    </span>
                    <AcceptanceStageBadge stage={entry.stage} />
                    <span className="text-xs text-muted-foreground">
                      {formatTimeSince(entry.notified_at)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm">
                    <span className="font-medium">{entry.driver_name}</span>
                    {" → "}
                    {entry.patient_name}
                    {" → "}
                    <span className="text-muted-foreground">
                      {entry.destination_name}
                    </span>
                  </p>
                  {entry.rejection_reason_text && (
                    <p className="mt-1 text-xs text-red-600">
                      Grund: {entry.rejection_reason_text}
                    </p>
                  )}
                </div>
                {onReassign && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-3 shrink-0"
                    onClick={() => onReassign(entry.ride_id)}
                  >
                    Neu zuweisen
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
