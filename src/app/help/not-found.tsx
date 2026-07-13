import Link from "next/link"

/**
 * Not-found page for the public help area.
 */
export default function HelpNotFound(): React.ReactElement {
  return (
    <div className="mx-auto max-w-xl space-y-6 py-12 text-center">
      <p className="text-6xl font-bold text-slate-300">?</p>
      <h1 className="text-2xl font-semibold text-slate-900">
        Diese Hilfe-Seite gibt es nicht
      </h1>
      <p className="text-lg text-slate-600">
        Die gesuchte Anleitung wurde nicht gefunden. Vielleicht wurde sie
        umbenannt oder verschoben.
      </p>
      <Link
        href="/help"
        className="inline-flex items-center rounded-xl bg-primary px-5 py-3 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Zur Hilfe-Startseite
      </Link>
    </div>
  )
}
