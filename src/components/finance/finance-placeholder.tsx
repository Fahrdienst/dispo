import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface FinancePlaceholderProps {
  title: string
  phase: string
  children: React.ReactNode
}

/**
 * Placeholder for finance sub-pages whose feature ships in a later M14 phase.
 * Keeps the /finance navigation fully wired (Issue #146) while the concrete
 * flows (14.2–14.4) are still pending.
 */
export function FinancePlaceholder({
  title,
  phase,
  children,
}: FinancePlaceholderProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Folgt in {phase}.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {children}
      </CardContent>
    </Card>
  )
}
