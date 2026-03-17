"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { QuickCaptureDialog } from "./quick-capture-dialog"
import { cn } from "@/lib/utils"

interface QuickCaptureButtonProps {
  /** Pre-fill date (YYYY-MM-DD) in the quick capture dialog */
  defaultDate?: string
  /** Button variant */
  variant?: "default" | "fab"
  /** Additional class names */
  className?: string
}

/**
 * Client wrapper that renders a button and controls the QuickCaptureDialog state.
 * Use variant="fab" for a floating action button style.
 */
export function QuickCaptureButton({
  defaultDate,
  variant = "default",
  className,
}: QuickCaptureButtonProps) {
  const [open, setOpen] = useState(false)

  if (variant === "fab") {
    return (
      <>
        <Button
          onClick={() => setOpen(true)}
          size="lg"
          className={cn(
            "fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-xl",
            "md:h-auto md:w-auto md:rounded-xl md:px-5",
            className
          )}
          aria-label="Neue Fahrt schnell erfassen"
        >
          <Plus className="h-6 w-6 md:h-4 md:w-4" />
          <span className="hidden md:inline">Neue Fahrt</span>
        </Button>
        <QuickCaptureDialog
          open={open}
          onOpenChange={setOpen}
          defaultDate={defaultDate}
        />
      </>
    )
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className={className}
      >
        <Plus className="h-4 w-4" />
        Neue Fahrt
      </Button>
      <QuickCaptureDialog
        open={open}
        onOpenChange={setOpen}
        defaultDate={defaultDate}
      />
    </>
  )
}
