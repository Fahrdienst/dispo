import { redirect } from "next/navigation";

// Canonical route is now "/passwort-vergessen". This legacy path only redirects
// so bookmarked/old links keep working without duplicating the form logic.
export default function ForgotPasswordRedirect(): never {
  redirect("/passwort-vergessen");
}
