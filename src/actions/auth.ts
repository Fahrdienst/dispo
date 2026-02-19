"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import type { ActionResult } from "@/actions/shared"

export async function login(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient()

  const email = formData.get("email") as string
  const password = formData.get("password") as string

  if (!email || !password) {
    return { success: false, error: "E-Mail und Passwort sind erforderlich" }
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { success: false, error: "E-Mail oder Passwort ist falsch" }
  }

  redirect("/")
}
