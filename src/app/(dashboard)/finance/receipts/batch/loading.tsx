import { Skeleton } from "@/components/ui/skeleton"

export default function ReceiptBatchLoading(): React.ReactElement {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-7 w-40" />
      </div>
      <Skeleton className="h-44 w-full rounded-xl" />
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  )
}
