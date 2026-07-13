import Link from "next/link"
import { LifeBuoy } from "lucide-react"
import { HelpButton } from "@/components/shared/help-button"

/**
 * Public help layout — deliberately wide and highly readable (18px base via
 * `.help-prose` / container styles), with skip links and print-friendly
 * behaviour. This is intentionally NOT the narrow `(public)` auth layout.
 */
export default function HelpLayout({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div className="min-h-screen bg-slate-50 text-[17px] text-slate-800 md:text-[18px]">
      <a
        href="#help-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow-md"
      >
        Zum Inhalt springen
      </a>

      <header className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link
            href="/help"
            className="flex items-center gap-2.5 font-semibold text-slate-900"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <LifeBuoy className="h-5 w-5" aria-hidden />
            </span>
            Hilfe &amp; Anleitungen
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-slate-200 px-4 py-2 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Zur Anmeldung
          </Link>
        </div>
      </header>

      <main id="help-main" className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {children}
      </main>

      {/* Contextual help button on public help pages (no feedback — anonymous). */}
      <HelpButton />

      <footer className="border-t border-slate-200 bg-white print:hidden">
        <div className="mx-auto max-w-5xl px-4 py-6 text-base text-slate-500 sm:px-6">
          <p>
            Brauchen Sie persönliche Unterstützung?{" "}
            <Link href="/help/kontakt" className="font-medium text-primary underline">
              Kontakt aufnehmen
            </Link>
          </p>
        </div>
      </footer>
    </div>
  )
}
