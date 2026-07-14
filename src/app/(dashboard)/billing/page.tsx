import { redirect } from "next/navigation"

/**
 * The former Verrechnung moved into the /finance area (Issue #146, ADR-015 E9).
 * This redirect keeps existing bookmarks/links working.
 */
export default function BillingRedirectPage() {
  redirect("/finance/export")
}
