"use client"

import { useTransition, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { retryFailedGeocoding } from "@/actions/geocoding"

interface RetryResult {
  patients_processed: number
  patients_success: number
  destinations_processed: number
  destinations_success: number
}

type ResultState =
  | { type: "idle" }
  | { type: "success"; data: RetryResult }
  | { type: "error"; message: string }

export function RetryGeocodingCard() {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<ResultState>({ type: "idle" })

  function handleRetry() {
    setResult({ type: "idle" })
    startTransition(async () => {
      const response = await retryFailedGeocoding()
      if (response.success) {
        setResult({ type: "success", data: response.data })
      } else {
        setResult({
          type: "error",
          message: response.error ?? "Unbekannter Fehler",
        })
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Geocoding</CardTitle>
        <CardDescription>
          Adressen ohne Koordinaten erneut geocoden
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleRetry} disabled={isPending}>
          {isPending
            ? "Geocoding laeuft..."
            : "Fehlgeschlagene Adressen erneut geocoden"}
        </Button>

        {result.type === "success" && (
          <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm dark:border-green-800 dark:bg-green-950">
            <p className="font-medium text-green-800 dark:text-green-200">
              Geocoding abgeschlossen
            </p>
            <p className="mt-1 text-green-700 dark:text-green-300">
              Patienten: {result.data.patients_success}/
              {result.data.patients_processed} erfolgreich
            </p>
            <p className="text-green-700 dark:text-green-300">
              Ziele: {result.data.destinations_success}/
              {result.data.destinations_processed} erfolgreich
            </p>
          </div>
        )}

        {result.type === "error" && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm dark:border-red-800 dark:bg-red-950">
            <p className="font-medium text-red-800 dark:text-red-200">
              Fehler
            </p>
            <p className="mt-1 text-red-700 dark:text-red-300">
              {result.message}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
