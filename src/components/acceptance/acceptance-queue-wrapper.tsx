"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { AcceptanceQueue, type QueueEntry } from "./acceptance-queue"
import { reassignRide } from "@/actions/acceptance"

interface AcceptanceQueueWrapperProps {
  entries: QueueEntry[]
}

/**
 * Client wrapper that provides the onReassign callback to AcceptanceQueue.
 * Needed because the dispatch page is a Server Component.
 */
export function AcceptanceQueueWrapper({
  entries,
}: AcceptanceQueueWrapperProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleReassign(rideId: string): void {
    if (isPending) return

    startTransition(async () => {
      const result = await reassignRide(rideId)
      if (!result.success) {
        alert(result.error ?? "Neuzuweisung fehlgeschlagen")
      } else {
        router.refresh()
      }
    })
  }

  return (
    <AcceptanceQueue
      entries={entries}
      onReassign={handleReassign}
    />
  )
}
