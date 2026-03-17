/**
 * Minimal layout for the printable dispatch day sheet.
 * Overrides the dashboard layout's sidebar and padding for clean print output.
 * The parent dashboard layout still wraps this, but we hide the sidebar
 * and max-width container via CSS in the page component.
 */
export default function PrintLayout({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  return <>{children}</>
}
