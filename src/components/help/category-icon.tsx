import {
  BookOpen,
  CarFront,
  Compass,
  CreditCard,
  LifeBuoy,
  Settings,
  UserRound,
  Users,
} from "lucide-react"
import type { HelpCategory } from "@/lib/help/types"

const ICONS: Record<HelpCategory, React.ReactNode> = {
  grundlagen: <BookOpen className="h-6 w-6" aria-hidden />,
  fahrten: <CarFront className="h-6 w-6" aria-hidden />,
  disposition: <Compass className="h-6 w-6" aria-hidden />,
  stammdaten: <Users className="h-6 w-6" aria-hidden />,
  abrechnung: <CreditCard className="h-6 w-6" aria-hidden />,
  fahrer: <UserRound className="h-6 w-6" aria-hidden />,
  administration: <Settings className="h-6 w-6" aria-hidden />,
  hilfe: <LifeBuoy className="h-6 w-6" aria-hidden />,
}

/** Returns the icon element associated with a help category. */
export function getCategoryIcon(category: HelpCategory): React.ReactNode {
  return ICONS[category]
}
