import { createAdminClient } from "@/lib/supabase/admin"
import type { Json } from "@/lib/types/database"

type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "status_change"
  | "reassign"
  | "login"
  | "deactivate"
  | "activate"

type AuditEntityType =
  | "ride"
  | "patient"
  | "driver"
  | "destination"
  | "user"
  | "organization"
  | "fare"
  | "zone"

interface AuditEntry {
  userId: string
  userRole: string
  action: AuditAction
  entityType: AuditEntityType
  entityId?: string
  changes?: Record<string, { old: unknown; new: unknown }>
  metadata?: Record<string, unknown>
}

/**
 * Log an audit trail entry using the admin (service role) client.
 * This function is intentionally fire-and-forget safe: it catches all errors
 * internally so that audit logging never breaks the main operation.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from("audit_log").insert({
      user_id: entry.userId,
      user_role: entry.userRole,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      changes: (entry.changes as Json) ?? null,
      metadata: (entry.metadata as Json) ?? null,
    })

    if (error) {
      console.error("[audit] Failed to insert audit log:", error.message)
    }
  } catch (error) {
    // Audit logging should never break the main operation
    console.error("[audit] Failed to log:", error)
  }
}
