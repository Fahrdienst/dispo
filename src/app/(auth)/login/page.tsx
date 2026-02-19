import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Anmelden - Fahrdienst",
};

export default function LoginPage(): React.ReactElement {
  return (
    <div className="rounded-lg border border-border bg-white p-8 shadow-sm">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-foreground">Anmelden</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Melden Sie sich mit Ihrem Konto an
        </p>
      </div>
      <LoginForm />
    </div>
  );
}
