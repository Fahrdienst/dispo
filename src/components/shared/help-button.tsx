"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { HelpCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { resolveHelpContext } from "@/lib/help/context-map"

/** localStorage flag: set once the user has interacted with the help button. */
const SEEN_STORAGE_KEY = "help-button-seen"

export interface HelpButtonProps {
  /**
   * Optional slot rendered directly above the help button (e.g. a feedback
   * trigger). Defaults to nothing. This component MUST NOT know anything about
   * what is passed in here — it is a pure layout slot.
   */
  extraAction?: React.ReactNode
  /** Optional extra classes for the fixed positioning wrapper. */
  className?: string
}

/**
 * Returns true when the currently focused element is a text input surface where
 * the `?` / `F1` shortcuts should be ignored (so typing a `?` does not navigate).
 */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
  if (target.isContentEditable) return true
  return false
}

/**
 * Floating, always-available contextual help button.
 *
 * - Resolves the current pathname to a help context and links to `/help/{slug}`.
 * - Shows a tooltip with the context label.
 * - Keyboard shortcuts: `?` (Shift+/) and `F1` open the contextual help.
 * - First-visit pulse ring until the user interacts once.
 *
 * Fully self-contained: no imports from layout files, the feedback system, or
 * app overlays. Mount it once near the root of an authenticated layout.
 */
export function HelpButton({ extraAction, className }: HelpButtonProps): React.JSX.Element {
  const pathname = usePathname()
  const router = useRouter()

  const context = resolveHelpContext(pathname ?? "")
  const helpHref = `/help/${context.helpSlug}`

  // Assume "seen" during SSR / first render to avoid a hydration mismatch and a
  // pulse flash for returning users. Corrected in the effect below.
  const [hasSeen, setHasSeen] = React.useState<boolean>(true)

  React.useEffect(() => {
    try {
      const seen = window.localStorage.getItem(SEEN_STORAGE_KEY)
      if (seen !== "true") {
        setHasSeen(false)
      }
    } catch {
      // localStorage may be unavailable (private mode / SSR edge) — skip pulse.
    }
  }, [])

  const markSeen = React.useCallback(() => {
    setHasSeen(true)
    try {
      window.localStorage.setItem(SEEN_STORAGE_KEY, "true")
    } catch {
      // Ignore persistence failures — the in-memory flag still hides the pulse.
    }
  }, [])

  // Keep the latest href in a ref so the keydown listener stays stable and does
  // not need re-binding on every navigation.
  const helpHrefRef = React.useRef(helpHref)
  helpHrefRef.current = helpHref

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      // Do not hijack typing in form fields / editable content.
      if (isEditableTarget(event.target)) return
      // Ignore combos with modifier keys other than Shift (Shift is needed for `?`).
      if (event.ctrlKey || event.metaKey || event.altKey) return

      const isQuestionMark = event.key === "?"
      const isF1 = event.key === "F1"

      if (isQuestionMark || isF1) {
        event.preventDefault()
        markSeen()
        router.push(helpHrefRef.current)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [router, markSeen])

  return (
    <div
      className={cn(
        "pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 print:hidden",
        className
      )}
    >
      {extraAction ? (
        <div className="pointer-events-auto">{extraAction}</div>
      ) : null}

      <div className="group pointer-events-auto relative">
        {/* Visual tooltip — hover & keyboard focus. Decorative; the link carries
            the accessible name via aria-label. */}
        <span
          role="tooltip"
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute bottom-1/2 right-full mr-3 translate-y-1/2 whitespace-nowrap",
            "rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background shadow-lg",
            "opacity-0 transition-opacity duration-150",
            "group-hover:opacity-100 group-focus-within:opacity-100"
          )}
        >
          {context.label}
        </span>

        {/* First-visit pulse ring (behind the button). */}
        {!hasSeen ? (
          <span
            aria-hidden="true"
            className="absolute inset-0 -z-10 animate-ping rounded-full bg-primary/40"
          />
        ) : null}

        <Link
          href={helpHref}
          aria-label={context.label}
          title={context.label}
          onClick={markSeen}
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-full",
            "bg-primary text-primary-foreground shadow-xl",
            "ring-2 ring-primary-foreground/20 transition-all duration-200",
            "hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-2xl",
            "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
          )}
        >
          <HelpCircle className="h-8 w-8" strokeWidth={2.25} aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}

export default HelpButton
