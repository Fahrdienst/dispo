import { HelpButton } from "@/components/shared/help-button"
import { FeedbackTrigger } from "@/components/shared/feedback-trigger"

interface AppOverlaysProps {
  /** Logged-in user's e-mail, used to pre-fill the feedback contact field. */
  userEmail?: string
}

/**
 * Global floating overlays for authenticated app surfaces: the contextual help
 * button (#87) with the feedback entry point (#88) mounted into its slot.
 *
 * Mount once near the root of an authenticated layout. For anonymous/public
 * surfaces, mount `<HelpButton />` on its own instead — feedback requires a
 * logged-in user.
 */
export function AppOverlays({ userEmail }: AppOverlaysProps): React.ReactElement {
  return (
    <HelpButton
      extraAction={<FeedbackTrigger defaultEmail={userEmail} label="Feedback" />}
    />
  )
}
