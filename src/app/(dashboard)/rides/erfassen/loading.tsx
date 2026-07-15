export default function ErfassenLoading() {
  return (
    <div className="space-y-6">
      {/* Page header skeleton */}
      <div className="glass-panel space-y-3 rounded-2xl p-5 sm:p-6">
        <div className="h-5 w-32 animate-pulse rounded bg-muted" />
        <div className="h-7 w-48 animate-pulse rounded bg-muted" />
      </div>

      {/* Two-column skeleton */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_minmax(360px,440px)] lg:items-start">
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-4 rounded-xl border p-6">
              <div className="h-5 w-40 animate-pulse rounded bg-muted" />
              <div className="h-11 w-full animate-pulse rounded bg-muted" />
              <div className="h-11 w-full animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <div className="h-48 w-full animate-pulse rounded-xl bg-muted" />
          <div className="h-40 w-full animate-pulse rounded-xl bg-muted" />
          <div className="h-24 w-full animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    </div>
  )
}
