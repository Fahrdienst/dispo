"use client"

import { useFormState } from "react-dom"
import { useTransition, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  updateOrganizationSettings,
  uploadOrganizationLogo,
  deleteOrganizationLogo,
} from "@/actions/organization"
import { sendTestEmail } from "@/actions/system"
import { SubmitButton } from "@/components/shared/submit-button"
import { Upload, Trash2, Send, ImageIcon } from "lucide-react"
import type { OrganizationSettings } from "@/actions/organization"
import type { ActionResult } from "@/actions/shared"

interface Props {
  settings: OrganizationSettings | null
}

export function OrganizationSettingsForm({ settings }: Props) {
  const [state, formAction] = useFormState(
    updateOrganizationSettings,
    null as ActionResult<OrganizationSettings> | null
  )

  // Logo state
  const [logoUrl, setLogoUrl] = useState(settings?.logo_url ?? null)
  const [logoMsg, setLogoMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [isUploading, startUpload] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  // Test email
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [isSendingEmail, startEmailSend] = useTransition()

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoMsg(null)

    const fd = new FormData()
    fd.append("logo", file)

    startUpload(async () => {
      const res = await uploadOrganizationLogo(fd)
      if (res.success) {
        setLogoUrl(res.data.logo_url)
        setLogoMsg({ ok: true, text: "Logo hochgeladen" })
      } else {
        setLogoMsg({ ok: false, text: res.error || "Fehler" })
      }
    })

    if (fileRef.current) fileRef.current.value = ""
  }

  function handleLogoDelete() {
    setLogoMsg(null)
    startUpload(async () => {
      const res = await deleteOrganizationLogo()
      if (res.success) {
        setLogoUrl(null)
        setLogoMsg({ ok: true, text: "Logo entfernt" })
      } else {
        setLogoMsg({ ok: false, text: res.error || "Fehler" })
      }
    })
  }

  function handleTestEmail() {
    setEmailMsg(null)
    startEmailSend(async () => {
      const res = await sendTestEmail()
      if (res.success) {
        setEmailMsg({ ok: true, text: "Test-E-Mail wurde gesendet" })
      } else {
        setEmailMsg({ ok: false, text: res.error || "Fehler" })
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Feedback */}
      {state && !state.success && state.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}
      {state?.success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Einstellungen gespeichert
        </div>
      )}

      <form action={formAction} className="space-y-6">
        {/* ============================================================= */}
        {/* Organisation */}
        {/* ============================================================= */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-base font-semibold">Organisation</h2>
            <p className="text-xs text-slate-500">
              Diese Daten erscheinen auf Quittungen und Belegen.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="org_name">Organisationsname *</Label>
              <Input
                id="org_name"
                name="org_name"
                defaultValue={settings?.org_name ?? "Fahrdienst"}
                required
                placeholder="z.B. Fahrdienst Muster AG"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="org_street">Strasse</Label>
              <Input
                id="org_street"
                name="org_street"
                defaultValue={settings?.org_street ?? ""}
                placeholder="z.B. Musterstrasse 12"
              />
            </div>
            <div>
              <Label htmlFor="org_postal_code">PLZ</Label>
              <Input
                id="org_postal_code"
                name="org_postal_code"
                defaultValue={settings?.org_postal_code ?? ""}
                placeholder="8000"
                maxLength={4}
              />
            </div>
            <div>
              <Label htmlFor="org_city">Ort</Label>
              <Input
                id="org_city"
                name="org_city"
                defaultValue={settings?.org_city ?? ""}
                placeholder="Zürich"
              />
            </div>
            <div>
              <Label htmlFor="org_phone">Telefon</Label>
              <Input
                id="org_phone"
                name="org_phone"
                defaultValue={settings?.org_phone ?? ""}
                placeholder="+41 44 123 45 67"
              />
            </div>
            <div>
              <Label htmlFor="org_email">E-Mail</Label>
              <Input
                id="org_email"
                name="org_email"
                type="email"
                defaultValue={settings?.org_email ?? ""}
                placeholder="info@fahrdienst.ch"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="org_website">Website</Label>
              <Input
                id="org_website"
                name="org_website"
                defaultValue={settings?.org_website ?? ""}
                placeholder="https://www.fahrdienst.ch"
              />
            </div>
          </div>
        </div>

        {/* ============================================================= */}
        {/* Logo & Branding */}
        {/* ============================================================= */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-base font-semibold">Logo & Branding</h2>
            <p className="text-xs text-slate-500">
              Logo und Farben für Belege und Quittungen.
            </p>
          </div>
          <div className="p-6">
            {/* Logo */}
            <div className="mb-6 flex items-center gap-4">
              {logoUrl ? (
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-xl border-2 border-dashed border-slate-300">
                  <ImageIcon className="h-8 w-8 text-slate-400" />
                </div>
              )}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileRef.current?.click()}
                    disabled={isUploading}
                  >
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                    {isUploading ? "Hochladen..." : logoUrl ? "Ersetzen" : "Hochladen"}
                  </Button>
                  {logoUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleLogoDelete}
                      disabled={isUploading}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Entfernen
                    </Button>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  PNG, JPEG, SVG oder WebP. Max. 2 MB.
                </p>
                {logoMsg && (
                  <p className={`text-xs ${logoMsg.ok ? "text-emerald-600" : "text-red-600"}`}>
                    {logoMsg.text}
                  </p>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                onChange={handleLogoUpload}
                className="hidden"
              />
            </div>

            {/* Colors */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="primary_color">Primärfarbe</Label>
                <div className="mt-1 flex items-center gap-3">
                  <input
                    type="color"
                    name="primary_color"
                    id="primary_color"
                    defaultValue={settings?.primary_color ?? "#000000"}
                    className="h-10 w-10 cursor-pointer rounded border border-slate-300"
                  />
                  <span className="font-mono text-sm text-slate-500">
                    {settings?.primary_color ?? "#000000"}
                  </span>
                </div>
              </div>
              <div>
                <Label htmlFor="secondary_color">Sekundärfarbe</Label>
                <div className="mt-1 flex items-center gap-3">
                  <input
                    type="color"
                    name="secondary_color"
                    id="secondary_color"
                    defaultValue={settings?.secondary_color ?? "#0066FF"}
                    className="h-10 w-10 cursor-pointer rounded border border-slate-300"
                  />
                  <span className="font-mono text-sm text-slate-500">
                    {settings?.secondary_color ?? "#0066FF"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================= */}
        {/* Kommunikation */}
        {/* ============================================================= */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-base font-semibold">Benachrichtigungen</h2>
            <p className="text-xs text-slate-500">
              E-Mail- und SMS-Kommunikation ein-/ausschalten.
            </p>
          </div>
          <div className="space-y-4 p-6">
            {/* Email Toggle */}
            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 p-4 transition-colors hover:bg-slate-50">
              <div>
                <p className="text-sm font-medium">E-Mail-Benachrichtigungen</p>
                <p className="text-xs text-slate-500">E-Mails an Fahrer senden</p>
              </div>
              <input
                type="hidden"
                name="email_enabled"
                value="false"
              />
              <input
                type="checkbox"
                name="email_enabled"
                value="true"
                defaultChecked={settings?.email_enabled ?? false}
                className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
            </label>

            {/* SMS Toggle */}
            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 p-4 transition-colors hover:bg-slate-50">
              <div>
                <p className="text-sm font-medium">SMS-Benachrichtigungen</p>
                <p className="text-xs text-slate-500">SMS an Patienten und Fahrer</p>
              </div>
              <input
                type="hidden"
                name="sms_enabled"
                value="false"
              />
              <input
                type="checkbox"
                name="sms_enabled"
                value="true"
                defaultChecked={settings?.sms_enabled ?? false}
                className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
            </label>

            {/* Email From */}
            <div className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="email_from_name">Absender-Name</Label>
                <Input
                  id="email_from_name"
                  name="email_from_name"
                  defaultValue={settings?.email_from_name ?? "Fahrdienst"}
                  placeholder="Fahrdienst Muster AG"
                />
              </div>
              <div>
                <Label htmlFor="email_from_address">Absender-Adresse</Label>
                <Input
                  id="email_from_address"
                  name="email_from_address"
                  type="email"
                  defaultValue={settings?.email_from_address ?? ""}
                  placeholder="noreply@fahrdienst.ch"
                />
              </div>
            </div>

            {/* Test Email Button */}
            <div className="flex items-center gap-3 border-t border-slate-200 pt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestEmail}
                disabled={isSendingEmail}
              >
                <Send className="mr-1.5 h-3.5 w-3.5" />
                {isSendingEmail ? "Wird gesendet..." : "Test-E-Mail senden"}
              </Button>
              {emailMsg && (
                <p className={`text-xs ${emailMsg.ok ? "text-emerald-600" : "text-red-600"}`}>
                  {emailMsg.text}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="flex justify-end">
          <SubmitButton>Einstellungen speichern</SubmitButton>
        </div>
      </form>
    </div>
  )
}
