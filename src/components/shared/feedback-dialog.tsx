"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { Loader2, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { submitFeedback } from "@/actions/feedback"
import type { FeedbackType } from "@/lib/validations/feedback"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface FeedbackDialogProps {
  /** Pre-fill the contact e-mail field (e.g. the logged-in user's address). */
  defaultEmail?: string
  /** Controlled open state. Omit for uncontrolled usage. */
  open?: boolean
  /** Controlled open-change handler. */
  onOpenChange?: (open: boolean) => void
}

const TYPE_OPTIONS: { value: FeedbackType; emoji: string; label: string }[] = [
  { value: "bug", emoji: "🐛", label: "Etwas funktioniert nicht" },
  { value: "idea", emoji: "💡", label: "Ich habe eine Idee" },
  { value: "other", emoji: "❓", label: "Sonstiges" },
]

const MAX_SCREENSHOT_BYTES = 2 * 1024 * 1024 // 2 MB
const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg"]

export function FeedbackDialog({
  defaultEmail,
  open,
  onOpenChange,
}: FeedbackDialogProps) {
  const [isPending, startTransition] = useTransition()

  // Support both controlled and uncontrolled open state.
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = open !== undefined
  const dialogOpen = isControlled ? open : internalOpen

  const setDialogOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next)
      onOpenChange?.(next)
    },
    [isControlled, onOpenChange]
  )

  // Form state
  const [type, setType] = useState<FeedbackType>("bug")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [email, setEmail] = useState(defaultEmail ?? "")
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const [screenshotName, setScreenshotName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Reset the form whenever the dialog opens.
  useEffect(() => {
    if (dialogOpen) {
      setType("bug")
      setTitle("")
      setDescription("")
      setEmail(defaultEmail ?? "")
      setScreenshot(null)
      setScreenshotName(null)
      setError(null)
    }
  }, [dialogOpen, defaultEmail])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setError(null)
      const file = e.target.files?.[0]
      if (!file) {
        setScreenshot(null)
        setScreenshotName(null)
        return
      }

      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        setError("Nur PNG- oder JPEG-Bilder sind erlaubt.")
        e.target.value = ""
        return
      }
      if (file.size > MAX_SCREENSHOT_BYTES) {
        setError("Das Bild darf höchstens 2 MB gross sein.")
        e.target.value = ""
        return
      }

      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setScreenshot(reader.result)
          setScreenshotName(file.name)
        }
      }
      reader.onerror = () => {
        setError("Das Bild konnte nicht gelesen werden.")
      }
      reader.readAsDataURL(file)
    },
    []
  )

  const removeScreenshot = useCallback(() => {
    setScreenshot(null)
    setScreenshotName(null)
  }, [])

  const handleSubmit = useCallback(() => {
    setError(null)

    const trimmedTitle = title.trim()
    if (trimmedTitle.length < 3) {
      setError("Bitte geben Sie einen Titel mit mindestens 3 Zeichen ein.")
      return
    }

    startTransition(async () => {
      const result = await submitFeedback({
        type,
        title: trimmedTitle,
        description: description.trim() || undefined,
        contactEmail: email.trim() || undefined,
        screenshotBase64: screenshot ?? undefined,
        pageUrl:
          typeof window !== "undefined"
            ? window.location.pathname + window.location.search
            : undefined,
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      })

      if (!result.success) {
        setError(result.error ?? "Ihre Rückmeldung konnte nicht gesendet werden.")
        return
      }

      toast({
        title: "Vielen Dank!",
        description: "Ihre Meldung wurde erfolgreich gesendet.",
      })
      setDialogOpen(false)
    })
  }, [type, title, description, email, screenshot, setDialogOpen])

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="max-w-[520px] gap-5 p-6">
        <DialogHeader>
          <DialogTitle className="text-xl">Feedback senden</DialogTitle>
          <DialogDescription className="text-base">
            Helfen Sie uns, die App zu verbessern. Ihre Meldung geht direkt an
            das Entwicklungsteam.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p
            className="rounded-md bg-destructive/10 px-3 py-2 text-base text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="space-y-5">
          {/* 1. Type tiles */}
          <div className="space-y-2">
            <Label className="text-base">Um was geht es?</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value)}
                  aria-pressed={type === opt.value}
                  className={cn(
                    "flex min-h-[80px] flex-col items-center justify-center gap-1.5 rounded-lg border p-3 text-center transition-colors",
                    "focus:outline-none focus:ring-2 focus:ring-ring/40 focus:ring-offset-1",
                    type === opt.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input bg-white text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  <span className="text-2xl" aria-hidden="true">
                    {opt.emoji}
                  </span>
                  <span className="text-sm font-medium leading-tight">
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Title (required) */}
          <div className="space-y-1.5">
            <Label htmlFor="fb-title" className="text-base">
              Titel <span className="text-destructive">*</span>
            </Label>
            <Input
              id="fb-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="Kurze Zusammenfassung"
              className="h-11 text-base"
              autoFocus
            />
          </div>

          {/* 3. Description */}
          <div className="space-y-1.5">
            <Label htmlFor="fb-description" className="text-base">
              Beschreibung
            </Label>
            <Textarea
              id="fb-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={4000}
              rows={4}
              placeholder="Was ist passiert? Was hatten Sie erwartet?"
              className="text-base"
            />
          </div>

          {/* 4. Screenshot upload */}
          <div className="space-y-1.5">
            <Label htmlFor="fb-screenshot" className="text-base">
              Screenshot (optional)
            </Label>
            {screenshotName ? (
              <div className="flex items-center justify-between gap-2 rounded-md border border-input px-3 py-2">
                <span className="truncate text-sm text-muted-foreground">
                  {screenshotName}
                </span>
                <button
                  type="button"
                  onClick={removeScreenshot}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                  aria-label="Screenshot entfernen"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <Input
                id="fb-screenshot"
                type="file"
                accept="image/png,image/jpeg"
                onChange={handleFileChange}
                className="h-11 cursor-pointer text-base file:mr-3 file:cursor-pointer"
              />
            )}
            <p className="text-sm text-muted-foreground">
              PNG oder JPEG, max. 2 MB.
            </p>
          </div>

          {/* 5. Contact e-mail */}
          <div className="space-y-1.5">
            <Label htmlFor="fb-email" className="text-base">
              Ihre E-Mail (für Rückfragen)
            </Label>
            <Input
              id="fb-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="h-11 text-base"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="h-11 flex-1 text-base"
          >
            {isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            {isPending ? "Wird gesendet..." : "Absenden"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setDialogOpen(false)}
            disabled={isPending}
            className="h-11 text-base"
          >
            Abbrechen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
