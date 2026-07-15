export default function PatientDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="glass-panel space-y-3 rounded-2xl p-5 sm:p-6">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-56 animate-pulse rounded bg-muted" />
            <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-9 w-28 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="h-16 w-full animate-pulse rounded-lg border bg-muted" />
      <div className="h-[300px] w-full animate-pulse rounded-md border bg-muted" />
    </div>
  )
}
