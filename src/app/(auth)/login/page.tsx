import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Anmelden - Fahrdienst",
};

export default function LoginPage(): React.ReactElement {
  return (
    <div className="glass-panel rounded-3xl p-8 shadow-2xl shadow-slate-950/20">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900">
          <span className="text-lg font-bold text-white">FD</span>
        </div>
        <h1 className="text-2xl font-semibold text-foreground">Fahrdienst</h1>
        <p className="mt-1 text-sm text-muted-foreground">Melden Sie sich in Ihrer Dispositionskonsole an</p>
      </div>
      <LoginForm />
    </div>
  );
}
