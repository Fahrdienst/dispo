import { redirect } from "next/navigation";

// Canonical route is now "/passwort-setzen" (shared invite + reset target).
// This legacy path only redirects so existing reset links keep working without
// duplicating the form logic.
export default function ResetPasswordRedirect(): never {
  redirect("/passwort-setzen");
}
