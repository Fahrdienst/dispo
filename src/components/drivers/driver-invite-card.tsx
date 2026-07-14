"use client"

import { useEffect, useState, useTransition } from "react"
import { CheckCircle2, Mail, Send } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  getDriverInviteStatus,
  inviteDriver,
  type DriverInviteStatus,
} from "@/actions/driver-invite"

interface DriverInviteCardProps {
  driverId: string
  driverEmail: string | null
}

function formatDateTime(value: string | null): string {
  if (!value) return "unbekannt"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "unbekannt"
  return date.toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export function DriverInviteCard({ driverId, driverEmail }: DriverInviteCardProps) {
  const [status, setStatus] = useState<DriverInviteStatus | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [email, setEmail] = useState(driverEmail ?? "")
  const [formError, setFormError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  // Load the invitation status whenever the selected driver changes.
  useEffect(() => {
    let active = true
    setIsLoading(true)
    setStatusError(null)
    setFormError(null)
    setEmail(driverEmail ?? "")

    getDriverInviteStatus(driverId).then((result) => {
      if (!active) return
      if (result.success) {
        setStatus(result.data)
      } else {
        setStatusError(result.error ?? "Status konnte nicht geladen werden")
      }
      setIsLoading(false)
    })

    return () => {
      active = false
    }
  }, [driverId, driverEmail])

  function handleInvite() {
    setFormError(null)
    startTransition(async () => {
      const result = await inviteDriver(driverId, email)
      if (result.success) {
        setStatus(result.data.status)
      } else {
        setFormError(result.error ?? "Einladung fehlgeschlagen")
      }
    })
  }

  return (
    <>
      <Separator />
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-sm font-medium">Zugang / Self-Service</p>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Status wird geladen…</p>
        ) : statusError ? (
          <p className="text-sm text-destructive">{statusError}</p>
        ) : status?.state === "active" ? (
          <div className="space-y-1 text-sm">
            <Badge className="w-fit bg-green-100 text-green-800 hover:bg-green-100">
              <CheckCircle2 className="mr-1 h-3 w-3" /> Aktiv
            </Badge>
            <p className="text-muted-foreground">{status.email}</p>
            {status.lastSignInAt && (
              <p className="text-xs text-muted-foreground">
                Zuletzt angemeldet am {formatDateTime(status.lastSignInAt)}
              </p>
            )}
          </div>
        ) : status?.state === "invited" ? (
          <div className="space-y-1 text-sm">
            <Badge
              variant="secondary"
              className="w-fit bg-amber-100 text-amber-800 hover:bg-amber-100"
            >
              Eingeladen
            </Badge>
            <p className="text-muted-foreground">{status.email}</p>
            <p className="text-xs text-muted-foreground">
              Eingeladen am {formatDateTime(status.invitedAt)} — wartet auf
              Passwortvergabe
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Der Fahrer erhält eine E-Mail mit einem Link, um sein Passwort zu
              setzen und sich anzumelden.
            </p>
            <div className="space-y-1">
              <Label htmlFor="invite-email" className="text-xs">
                E-Mail-Adresse
              </Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="fahrer@example.ch"
                autoComplete="off"
              />
            </div>
            {formError && <p className="text-xs text-destructive">{formError}</p>}
            <Button
              type="button"
              size="sm"
              onClick={handleInvite}
              disabled={isPending || email.trim().length === 0}
            >
              <Send className="mr-1 h-3 w-3" />
              {isPending ? "Wird gesendet…" : "Einladen"}
            </Button>
          </div>
        )}
      </div>
    </>
  )
}
