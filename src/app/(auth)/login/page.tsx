import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Anmelden - Fahrdienst",
};

export default function LoginPage(): React.ReactElement {
  return (
    <div className="rounded-xl border border-border bg-white p-8 shadow-md">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-foreground">
          <span className="text-lg font-bold text-background">FD</span>
        </div>
        <h1 className="text-xl font-semibold text-foreground">Fahrdienst</h1>
        <p className="mt-1 text-sm text-muted-foreground">Melden Sie sich an</p>
      </div>
      <LoginForm />
    </div>
  );
}
