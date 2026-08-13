"use client"

import { useEffect, useState } from "react"

/**
 * Whether the primary input is a fine pointer (mouse/trackpad), via the
 * `(pointer: fine)` media query. Used to offer drag & drop only on desktop
 * (M15, #170) — on touch devices the click flow stays the one and only path.
 *
 * Starts as `false` (SSR-safe) and resolves after mount, so touch devices
 * never see a drag affordance flash.
 */
export function useIsPointerFine(): boolean {
  const [fine, setFine] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(pointer: fine)")
    setFine(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setFine(e.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  return fine
}
