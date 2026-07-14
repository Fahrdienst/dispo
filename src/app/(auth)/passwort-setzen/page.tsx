import type { Metadata } from "next";
import { SetPasswordForm } from "@/components/auth/set-password-form";

export const metadata: Metadata = {
  title: "Passwort setzen - Fahrdienst",
};

// Shared target for the driver invitation link and the password-reset link.
// The user arrives here with an active session (established by /auth/callback),
// sets a password, and is then routed to their role-based landing page.
export default function PasswortSetzenPage(): React.ReactElement {
  return (
    <div className="glass-panel rounded-3xl p-8 shadow-2xl shadow-slate-950/20">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900">
          <span className="text-lg font-bold text-white">FD</span>
        </div>
        <h1 className="text-2xl font-semibold text-foreground">Passwort setzen</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Wählen Sie ein sicheres Passwort für Ihren Zugang
        </p>
      </div>
      <SetPasswordForm />
    </div>
  );
}
