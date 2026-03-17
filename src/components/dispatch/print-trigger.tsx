"use client"

import { useEffect } from "react"

/**
 * Triggers window.print() once after the page has fully rendered.
 * Only fires on initial load, not on re-renders.
 */
export function PrintTrigger(): null {
  useEffect(() => {
    // Small delay so the browser can paint the table first
    const timer = setTimeout(() => {
      window.print()
    }, 500)
    return () => clearTimeout(timer)
  }, [])

  return null
}
