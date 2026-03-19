"use server"

import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/require-admin"
import type { ActionResult } from "@/actions/shared"

// =============================================================================
// TYPES
// =============================================================================

export type ServiceStatus = "healthy" | "degraded" | "unavailable" | "not_configured"

export interface SystemServiceHealth {
  name: string
  status: ServiceStatus
  message: string
  latencyMs?: number
}

export interface SystemInfo {
  appVersion: string
  nodeVersion: string
  nextVersion: string
  environment: string
  deploymentId: string | null
}

export interface EnvVarStatus {
  name: string
  configured: boolean
  category: "required" | "maps" | "sms" | "email" | "redis"
}

// =============================================================================
// SYSTEM HEALTH CHECK
// =============================================================================

export async function getSystemHealth(): Promise<SystemServiceHealth[]> {
  const auth = await requireAdmin()
  if (!auth.authorized) return []

  const services: SystemServiceHealth[] = []

  // Supabase Database
  try {
    const supabase = await createClient()
    const start = Date.now()
    const { error } = await supabase.from("profiles").select("id").limit(1)
    const latencyMs = Date.now() - start

    services.push({
      name: "Supabase Datenbank",
      status: error ? "degraded" : "healthy",
      message: error ? `Fehler: ${error.message}` : `Verbunden (${latencyMs}ms)`,
      latencyMs,
    })
  } catch {
    services.push({
      name: "Supabase Datenbank",
      status: "unavailable",
      message: "Nicht erreichbar",
    })
  }

  // Supabase Auth
  try {
    const supabase = await createClient()
    const start = Date.now()
    const { error } = await supabase.auth.getUser()
    const latencyMs = Date.now() - start

    services.push({
      name: "Supabase Auth",
      status: error ? "degraded" : "healthy",
      message: error ? `Fehler: ${error.message}` : `Verbunden (${latencyMs}ms)`,
      latencyMs,
    })
  } catch {
    services.push({
      name: "Supabase Auth",
      status: "unavailable",
      message: "Nicht erreichbar",
    })
  }

  // Google Maps
  services.push({
    name: "Google Maps (Client)",
    status: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? "healthy" : "not_configured",
    message: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? "API-Key konfiguriert" : "Nicht konfiguriert",
  })

  services.push({
    name: "Google Maps (Server)",
    status: process.env.GOOGLE_MAPS_API_KEY ? "healthy" : "not_configured",
    message: process.env.GOOGLE_MAPS_API_KEY ? "API-Key konfiguriert" : "Nicht konfiguriert",
  })

  // SMTP / Nodemailer
  const smtpHost = process.env.SMTP_HOST
  services.push({
    name: "E-Mail (SMTP)",
    status: smtpHost ? "healthy" : "not_configured",
    message: smtpHost ? `Konfiguriert (${smtpHost})` : "Nicht konfiguriert",
  })

  // Redis
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL
  services.push({
    name: "Redis (Upstash)",
    status: redisUrl ? "healthy" : "not_configured",
    message: redisUrl ? "Konfiguriert" : "Nicht konfiguriert (In-Memory Fallback)",
  })

  return services
}

// =============================================================================
// SYSTEM INFO
// =============================================================================

export async function getSystemInfo(): Promise<SystemInfo> {
  const auth = await requireAdmin()
  if (!auth.authorized) {
    return {
      appVersion: "?",
      nodeVersion: "?",
      nextVersion: "?",
      environment: "?",
      deploymentId: null,
    }
  }

  let appVersion = "0.0.0"
  let nextVersion = "unbekannt"
  try {
    const pkg = JSON.parse(
      (await import("fs")).readFileSync(
        require("path").resolve(process.cwd(), "package.json"),
        "utf-8"
      )
    )
    appVersion = pkg.version || "0.0.0"
    nextVersion = pkg.dependencies?.next || "unbekannt"
  } catch {
    // Ignore
  }

  return {
    appVersion,
    nodeVersion: process.version,
    nextVersion,
    environment: process.env.NODE_ENV || "development",
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID || null,
  }
}

// =============================================================================
// ENVIRONMENT VARIABLE STATUS
// =============================================================================

export async function getEnvVarStatus(): Promise<EnvVarStatus[]> {
  const auth = await requireAdmin()
  if (!auth.authorized) return []

  return [
    { name: "NEXT_PUBLIC_SUPABASE_URL", configured: !!process.env.NEXT_PUBLIC_SUPABASE_URL, category: "required" },
    { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", configured: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, category: "required" },
    { name: "SUPABASE_SERVICE_ROLE_KEY", configured: !!process.env.SUPABASE_SERVICE_ROLE_KEY, category: "required" },
    { name: "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", configured: !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, category: "maps" },
    { name: "GOOGLE_MAPS_API_KEY", configured: !!process.env.GOOGLE_MAPS_API_KEY, category: "maps" },
    { name: "SMTP_HOST", configured: !!process.env.SMTP_HOST, category: "email" },
    { name: "SMTP_PORT", configured: !!process.env.SMTP_PORT, category: "email" },
    { name: "SMTP_USER", configured: !!process.env.SMTP_USER, category: "email" },
    { name: "SMTP_PASS", configured: !!process.env.SMTP_PASS, category: "email" },
    { name: "UPSTASH_REDIS_REST_URL", configured: !!process.env.UPSTASH_REDIS_REST_URL, category: "redis" },
    { name: "UPSTASH_REDIS_REST_TOKEN", configured: !!process.env.UPSTASH_REDIS_REST_TOKEN, category: "redis" },
  ]
}

// =============================================================================
// SEND TEST EMAIL
// =============================================================================

export async function sendTestEmail(): Promise<ActionResult> {
  const auth = await requireAdmin()
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const smtpHost = process.env.SMTP_HOST
  if (!smtpHost) {
    return { success: false, error: "SMTP nicht konfiguriert" }
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) {
      return { success: false, error: "Keine E-Mail-Adresse für den aktuellen Benutzer" }
    }

    const nodemailer = await import("nodemailer")
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })

    await transporter.sendMail({
      from: process.env.SMTP_FROM || `Fahrdienst <noreply@${smtpHost}>`,
      to: user.email,
      subject: "Test-Benachrichtigung – Fahrdienst",
      html: `
        <h2>Test-E-Mail</h2>
        <p>Dies ist eine Testmail vom Fahrdienst-System.</p>
        <p>Wenn Sie diese E-Mail erhalten, funktioniert der E-Mail-Versand korrekt.</p>
        <hr />
        <p style="color: #666; font-size: 12px;">
          Gesendet am ${new Date().toLocaleString("de-CH")}
        </p>
      `,
    })

    return { success: true, data: undefined }
  } catch (err) {
    console.error("Test email failed:", err)
    return { success: false, error: "Fehler beim Senden der Test-E-Mail" }
  }
}
