"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  distanceBackfillBatch,
  getDistanceBackfillSkipped,
  type SkippedRide,
} from "@/actions/distance-backfill"
import type { DistanceBackfillError } from "@/lib/maps/distance-backfill"

const BATCH_SIZE = 25
const MAX_SHOWN_ERRORS = 200

type Phase = "idle" | "running" | "done" | "error"

interface Stats {
  processed: number
  succeeded: number
  failed: number
  remaining: number
  skipped: number
  total: number
}

const ZERO: Stats = {
  processed: 0,
  succeeded: 0,
  failed: 0,
  remaining: 0,
  skipped: 0,
  total: 0,
}

export function DistanceBackfillCard() {
  const [phase, setPhase] = useState<Phase>("idle")
  const [stats, setStats] = useState<Stats>(ZERO)
  const [errors, setErrors] = useState<DistanceBackfillError[]>([])
  const [skipped, setSkipped] = useState<SkippedRide[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const cancelRef = useRef(false)

  async function runBackfill() {
    cancelRef.current = false
    setPhase("running")
    setStats(ZERO)
    setErrors([])
    setSkipped([])
    setErrorMsg(null)

    let cursor: string | undefined
    let processed = 0
    let succeeded = 0
    let failed = 0
    let total = 0
    let skippedCount = 0
    const collected: DistanceBackfillError[] = []

    for (;;) {
      if (cancelRef.current) {
        setPhase("done")
        break
      }

      const res = await distanceBackfillBatch(BATCH_SIZE, cursor)
      if (!res.success) {
        setErrorMsg(res.error ?? "Unbekannter Fehler")
        setPhase("error")
        return
      }

      const d = res.data
      cursor = d.cursor
      processed += d.processed
      succeeded += d.succeeded
      failed += d.failed
      skippedCount = d.skipped
      total = Math.max(total, processed + d.remaining)
      for (const e of d.errors) {
        if (collected.length < MAX_SHOWN_ERRORS) collected.push(e)
      }

      setStats({
        processed,
        succeeded,
        failed,
        remaining: d.remaining,
        skipped: skippedCount,
        total,
      })
      setErrors([...collected])

      if (d.remaining === 0 || d.processed === 0) {
        setPhase("done")
        break
      }
    }

    // Load the manual-nachpflege report (skipped rides) once the run settles.
    const report = await getDistanceBackfillSkipped()
    if (report.success) setSkipped(report.data)
  }

  const percent =
    stats.total > 0 ? Math.round((stats.processed / stats.total) * 100) : 0
  const isRunning = phase === "running"

  return (
    <Card>
      <CardHeader>
        <CardTitle>Distanz-Backfill</CardTitle>
        <CardDescription>
          Abgeschlossene Fahrten ohne Distanz in Blöcken via Google Directions
          nachtragen (Patient &amp; Ziel müssen geocodiert sein). Erneut
          ausführbar; bereits erfasste Distanzen bleiben unangetastet.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <Button onClick={runBackfill} disabled={isRunning}>
            {isRunning ? "Läuft…" : "Backfill starten"}
          </Button>
          {isRunning && (
            <Button
              variant="outline"
              onClick={() => {
                cancelRef.current = true
              }}
            >
              Abbrechen
            </Button>
          )}
        </div>

        {(isRunning || phase === "done") && stats.total > 0 && (
          <div className="space-y-2">
            <Progress value={percent} />
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>
                {stats.processed}/{stats.total} verarbeitet ({percent}%)
              </span>
              <span className="text-green-700 dark:text-green-400">
                {stats.succeeded} erfolgreich
              </span>
              {stats.failed > 0 && (
                <span className="text-amber-700 dark:text-amber-400">
                  {stats.failed} fehlgeschlagen
                </span>
              )}
              <span>{stats.remaining} verbleibend</span>
              {stats.skipped > 0 && (
                <span className="text-amber-700 dark:text-amber-400">
                  {stats.skipped} ohne Geodaten (übersprungen)
                </span>
              )}
            </div>
          </div>
        )}

        {phase === "done" && (
          <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm dark:border-green-800 dark:bg-green-950">
            <p className="font-medium text-green-800 dark:text-green-200">
              {cancelRef.current ? "Backfill abgebrochen" : "Backfill abgeschlossen"}
            </p>
            <p className="mt-1 text-green-700 dark:text-green-300">
              {stats.succeeded} erfolgreich, {stats.failed} fehlgeschlagen von{" "}
              {stats.processed} verarbeitet.
            </p>
          </div>
        )}

        {phase === "error" && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm dark:border-red-800 dark:bg-red-950">
            <p className="font-medium text-red-800 dark:text-red-200">Fehler</p>
            <p className="mt-1 text-red-700 dark:text-red-300">{errorMsg}</p>
          </div>
        )}

        {errors.length > 0 && (
          <div className="space-y-1 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950">
            <p className="font-medium text-amber-800 dark:text-amber-200">
              Route nicht berechenbar ({errors.length}
              {errors.length >= MAX_SHOWN_ERRORS ? "+" : ""}):
            </p>
            <div className="max-h-48 space-y-0.5 overflow-y-auto">
              {errors.map((err, i) => (
                <p
                  key={`${err.rideId}-${i}`}
                  className="text-xs text-amber-700 dark:text-amber-300"
                >
                  Fahrt {err.rideId.slice(0, 8)}… — {err.error}
                </p>
              ))}
            </div>
          </div>
        )}

        {phase === "done" && skipped.length > 0 && (
          <div className="space-y-1 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950">
            <p className="font-medium text-amber-800 dark:text-amber-200">
              Übersprungen — Geodaten fehlen ({skipped.length}). Adressen von
              Patient/Ziel geocodieren und Backfill erneut ausführen:
            </p>
            <div className="max-h-48 space-y-0.5 overflow-y-auto">
              {skipped.map((r) => (
                <p
                  key={r.id}
                  className="text-xs text-amber-700 dark:text-amber-300"
                >
                  Fahrt {r.id.slice(0, 8)}… vom {r.date}
                </p>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
