import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Passwort zurücksetzen - Fahrdienst",
};

export default function ResetPasswordPage(): React.ReactElement {
  return (
    <div className="glass-panel rounded-3xl p-8 shadow-2xl shadow-slate-950/20">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900">
          <span className="text-lg font-bold text-white">FD</span>
        </div>
        <h1 className="text-2xl font-semibold text-foreground">Passwort zurücksetzen</h1>
        <p className="mt-1 text-sm text-muted-foreground">Geben Sie Ihr neues Passwort ein</p>
      </div>
      <ResetPasswordForm />
    </div>
  );
}
