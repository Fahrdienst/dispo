import { AlertTriangle } from "lucide-react"

const ERROR_MESSAGES: Record<string, { title: string; description: string }> = {
  expired: {
    title: "Link abgelaufen",
    description:
      "Dieser Link ist abgelaufen oder wurde bereits verwendet. Bitte kontaktieren Sie die Disposition fuer weitere Informationen.",
  },
  invalid: {
    title: "Ungueltiger Link",
    description:
      "Der Link ist ungueltig. Bitte verwenden Sie den Link aus der E-Mail-Benachrichtigung.",
  },
  changed: {
    title: "Fahrt geaendert",
    description:
      "Die Fahrt wurde zwischenzeitlich geaendert oder einem anderen Fahrer zugewiesen. Bitte kontaktieren Sie die Disposition.",
  },
}

const DEFAULT_ERROR = {
  title: "Fehler",
  description:
    "Ein unbekannter Fehler ist aufgetreten. Bitte kontaktieren Sie die Disposition.",
}

export default async function RespondErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>
}) {
  const { reason } = await searchParams
  const matched = reason ? ERROR_MESSAGES[reason] : undefined
  const error = matched ?? DEFAULT_ERROR

  return (
    <div className="text-center">
      <div className="mb-6 flex justify-center">
        <AlertTriangle className="h-16 w-16 text-amber-500" />
      </div>

      <h2 className="mb-2 text-2xl font-bold text-gray-900">{error.title}</h2>

      <p className="text-gray-600">{error.description}</p>
    </div>
  )
}
