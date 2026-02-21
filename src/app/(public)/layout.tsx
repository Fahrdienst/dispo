export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div className="min-h-screen bg-slate-50/80">
      <header className="border-b border-white/80 bg-white/70 backdrop-blur">
        <div className="mx-auto max-w-md px-4 py-4">
          <h1 className="text-lg font-semibold text-slate-900">
            Dispo Krankentransport
          </h1>
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 py-12">{children}</main>
    </div>
  )
}
