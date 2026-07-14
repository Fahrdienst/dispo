import { redirect } from "next/navigation"
import Link from "next/link"
import { LogOut } from "lucide-react"
import { requireAuth } from "@/lib/auth/require-auth"
import { logout } from "@/actions/auth"
import { DriverNav } from "@/components/driver/driver-nav"

/**
 * Driver self-service shell (Issue #96).
 *
 * Mobile-first layout for drivers (often 60+, on a phone): a slim sticky top
 * bar with brand + sign-out, a thumb-reachable fixed bottom navigation, and a
 * centred single-column content column (max-w-md) that never scrolls
 * horizontally at 375px.
 *
 * `requireAuth(["driver"])` is defence-in-depth: the middleware already keeps
 * non-drivers out of /fahrer, but the layout redirects anyone who slips through
 * (unauthenticated or non-driver) back to "/".
 *
 * Sign-out lives in the top bar, deliberately separated from the primary
 * bottom nav, to avoid accidental logout mis-taps.
 */
export default async function DriverLayout({
  children,
}: {
  children: React.ReactNode
}): Promise<React.ReactElement> {
  const auth = await requireAuth(["driver"])
  if (!auth.authorized) {
    redirect("/")
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-slate-50">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm print:hidden">
        <Link href="/fahrer" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-xs font-bold text-white">
            FD
          </span>
          <span className="text-base font-semibold tracking-tight text-slate-900">
            Fahrdienst
          </span>
        </Link>
        <form action={logout}>
          <button
            type="submit"
            className="flex min-h-[44px] items-center gap-2 rounded-lg px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <LogOut className="h-5 w-5" aria-hidden="true" />
            Abmelden
          </button>
        </form>
      </header>

      {/* pb-28 keeps content clear of the fixed bottom nav. */}
      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-28 pt-5">
        {children}
      </main>

      <DriverNav />
    </div>
  )
}
