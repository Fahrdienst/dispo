"use server"

import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/require-auth"

export interface ComboboxItem {
  id: string
  label: string
  sublabel?: string
}

/**
 * Load all active patients for combobox display.
 * Returns id, formatted "Nachname, Vorname" as label, and city as sublabel.
 */
export async function getPatientsList(): Promise<ComboboxItem[]> {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("patients")
    .select("id, first_name, last_name, city")
    .eq("is_active", true)
    .order("last_name")

  if (error || !data) return []

  return data.map((p) => ({
    id: p.id,
    label: `${p.last_name}, ${p.first_name}`,
    sublabel: p.city ?? undefined,
  }))
}

/**
 * Load all active destinations for combobox display.
 * Returns id, display_name as label, and city as sublabel.
 */
export async function getDestinationsList(): Promise<ComboboxItem[]> {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("destinations")
    .select("id, display_name, city")
    .eq("is_active", true)
    .order("display_name")

  if (error || !data) return []

  return data.map((d) => ({
    id: d.id,
    label: d.display_name,
    sublabel: d.city ?? undefined,
  }))
}
