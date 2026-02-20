import { CheckCircle2, XCircle } from "lucide-react"

export default async function RespondSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>
}) {
  const { action } = await searchParams
  const isConfirm = action === "confirm"

  return (
    <div className="text-center">
      <div className="mb-6 flex justify-center">
        {isConfirm ? (
          <CheckCircle2 className="h-16 w-16 text-green-500" />
        ) : (
          <XCircle className="h-16 w-16 text-red-500" />
        )}
      </div>

      <h2 className="mb-2 text-2xl font-bold text-gray-900">
        {isConfirm ? "Fahrt angenommen" : "Fahrt abgelehnt"}
      </h2>

      <p className="text-gray-600">
        {isConfirm
          ? "Vielen Dank! Die Fahrt wurde erfolgreich bestaetigt. Die Disposition wurde benachrichtigt."
          : "Die Fahrt wurde abgelehnt. Die Disposition wird einen anderen Fahrer zuweisen."}
      </p>
    </div>
  )
}
