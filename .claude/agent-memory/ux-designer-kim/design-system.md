# FAHRDIENST APP — Design System
## Version 1.0 | Designer: Kim | Session 2 (complete, implementable)

This document is the binding design reference. All components, layouts,
and token decisions must trace back here. Changes require conscious revision.

---

## 1. Designprinzipien

1. **Status ist dominant.** Die wichtigste Information auf jedem Screen ist der aktuelle Zustand und die nächste erforderliche Aktion. Status-Farbe + Label müssen sofort erkennbar sein — vor dem Lesen.
2. **Klarheit vor Ästhetik.** Wenn etwas hübsch ist, aber einen Disponenten um 7 Uhr morgens mit 40 Fahrten verwirrt — schlägt es fehl.
3. **Informationsdichte wo nötig, Atemraum wo sinnvoll.** Operatoren brauchen dichte Tabellenansichten. Fahrer brauchen große Touch-Targets und minimalen Text.
4. **Progressive Disclosure.** Zeige das Minimum. Lass Nutzer einzoomen. Keine Überwältigung.
5. **Konsistenz erzeugt Vertrauen.** Gleiche Farben bedeuten immer das Gleiche. Gleiche Interaktionen verhalten sich gleich. Abweichungen werden als Fehler wahrgenommen.
6. **Fehlerprävention vor Fehlerbehandlung.** Invalide Aktionen deaktivieren. Eingaben einschränken. Destruktive Operationen bestätigen lassen.
7. **Zeit ist kritisch.** Zeiten und ETAs sind die wichtigsten Daten im System. Typografisch immer prominent, tabular-nums, mindestens font-medium.
8. **Die Karte ist das Operationssurface.** Liste und Karte sind immer im Dialog. Die Karte ist nie in einem Modal oder einem optionalen Drawer.
9. **Eine primäre Aktion pro Moment.** Jeder Screen und jeder State hat eine offensichtliche nächste Aktion. Mehrere gleichwertige Primäraktionen verlangsamen Entscheidungen.
10. **Healthcare-adjacent: ruhig, vertrauenswürdig, nicht flashy.** Keine Celebration-Animations. Kein übersättigtes UI. Operative Sicherheit durch visuelle Ruhe.

---

## 2. Typografie

### Schrift: Inter (Google Fonts)

**Begründung:**
- Optimiert für Screen-Lesbarkeit bei kleinen Größen
- Exzellentes Ziffern-Rendering — tabular figures verhindern Spaltenflimmern
- 9 Gewichte — eine Familie für alle Hierarchieebenen
- Google Fonts CDN: zuverlässig, schnell, keine Lizenzfragen
- Referenz: Linear, Vercel, Stripe — der Standard für operative SaaS-Oberflächen

**Keine zweite Schrift.** Inter übernimmt alle Rollen. Eine zweite Schrift erzeugt kognitiven Lärm ohne Nutzen.

**Setup (bereits in layout.tsx):**

```tsx
// src/app/layout.tsx
import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',  // optional: füge variable hinzu für CSS-Zugriff
})
```

**Globales tabular-nums (in globals.css implementiert):**

```css
body {
  font-feature-settings: "tnum";
  font-variant-numeric: tabular-nums;
}
```

### Type-Scale

| Rolle              | Tailwind-Klassen                                                    | Verwendung                             |
|--------------------|----------------------------------------------------------------------|----------------------------------------|
| Page Title         | `text-2xl font-semibold tracking-tight`                             | H1 in PageHeader                       |
| Section Header     | `text-base font-semibold`                                            | Card-Titel, Abschnitts-Grupierungen    |
| Table Header       | `text-xs font-medium uppercase tracking-wide text-muted-foreground` | TableHead-Zellen                       |
| Body Default       | `text-sm`                                                            | Tabellenzellen, Formular-Labels, Body  |
| Caption / Meta     | `text-xs text-muted-foreground`                                      | Zeitstempel, Sekundärinfos             |
| Zeit (Operator)    | `text-2xl font-semibold tabular-nums`                                | Abholzeit in Fahrtenliste              |
| Zeit (Driver)      | `text-5xl font-bold tabular-nums leading-none`                       | Fahrer-Screen Abholzeit                |
| Status-Badge Text  | `text-xs font-medium`                                                | Alle Status-Badges                     |
| Button Text        | `text-sm font-medium`                                                | Alle Buttons                           |
| Form Label         | `text-sm font-medium`                                                | shadcn Label-Komponente                |
| Input Text         | `text-sm`                                                            | shadcn Input / Select / Textarea       |
| Toast Message      | `text-sm font-medium` (titel) + `text-sm` (description)             | shadcn Toaster                         |

### Zeilenhöhe (line-height)

- Standard: Tailwind default (`leading-normal` = 1.5) für Body-Text
- Kompakte Tabellen: `leading-tight` (1.25) — spart Höhe ohne Lesbarkeitseinbuße
- Große Zeitanzeigen: `leading-none` (1.0) — verhindert unerwünschten Weißraum

### Schriftgewichte

| Weight    | Tailwind       | Verwendung                                       |
|-----------|----------------|--------------------------------------------------|
| 400       | `font-normal`  | Body-Text, Tabellenzellen, Input-Inhalt          |
| 500       | `font-medium`  | Labels, sekundäre Beschriftungen, Badge-Text     |
| 600       | `font-semibold`| Überschriften, Zeiten, Patient-Namen, Buttons    |
| 700       | `font-bold`    | Fahrer-Screen Zeitanzeige, kritische Alerts      |

---

## 3. Farben als semantische Tokens

### Philosophie

Farben kommunizieren Zustand. Ein Disponent lernt die Status-Palette in der ersten Woche.
Danach kommuniziert Farbe allein — bevor Text gelesen wird. Das ist das Ziel.

Regeln:
- Statusfarben werden **niemals** dekorativ eingesetzt
- Hintergründe bleiben neutral (weiß / grau-50)
- Farbintensität korreliert mit Dringlichkeit
- Barrierefreiheit: Jedes Status-Badge trägt Farbe UND Text-Label
- Die Karte (Google Maps) muss sich optisch einfügen: keine übersättigten Farben drumherum

### A) Neutral-Palette (shadcn/ui neutral, bereits in globals.css)

| Token                  | CSS Variable              | Hex       | HSL (CSS)          | Verwendung                              |
|------------------------|---------------------------|-----------|--------------------|-----------------------------------------|
| Hintergrund            | `--background`            | #FFFFFF   | `0 0% 100%`        | Seiten-Hintergrund                      |
| Oberfläche / Card      | `--card`                  | #FFFFFF   | `0 0% 100%`        | Cards, Panels                           |
| Muted Surface          | `--muted`                 | #F5F5F5   | `0 0% 96.1%`       | Sidebar, Tabellen-Header, Filter-Chips  |
| Primärtext             | `--foreground`            | #0A0A0A   | `0 0% 3.9%`        | Überschriften, Body-Text                |
| Muted Text             | `--muted-foreground`      | #737373   | `0 0% 45.1%`       | Sekundärtext, Captions, Platzhalter     |
| Border                 | `--border`                | #E5E5E5   | `0 0% 89.8%`       | Alle Rahmen, Trennlinien                |
| Input-Border           | `--input`                 | #E5E5E5   | `0 0% 89.8%`       | Formular-Felder                         |
| Primäraktion           | `--primary`               | #171717   | `0 0% 9%`          | Primär-Buttons, aktive Nav              |
| Destructive            | `--destructive`           | #EF4444   | `0 84.2% 60.2%`    | Löschen, Stornieren (Aktion)            |

### B) Accent / Brand

Kein separater Brand-Akzent. Die Primärfarbe (#171717 near-black) ist der Akzent.
Begründung: Healthcare-adjacent, ruhig, keine Corporate-Farbe, die mit Statusfarben konkurriert.

Falls ein zweiter Akzent je nötig wird (z.B. für einen "Neue Fahrt"-FAB):
- Kandidat: `blue-600` (#2563EB) — vertrauenswürdig, deutlich sichtbar, kollidiert nicht mit Statusfarben

### C) Statusfarben (alle 10 Status — vollständig unterscheidbar)

Semantische Unterscheidbarkeit: Jede Farbe hat eine eigene Hue-Gruppe.
Kein Status teilt sich eine Hue-Familie mit einem anderen.

| DB-Status    | Deutsches Label   | Hex      | Hue-Gruppe    | Badge-Bg       | Badge-Text       | Dot-Farbe      |
|--------------|-------------------|----------|---------------|----------------|------------------|----------------|
| unplanned    | Ungeplant         | #6B7280  | Gray          | bg-gray-100    | text-gray-700    | bg-gray-500    |
| planned      | Geplant           | #3B82F6  | Blue          | bg-blue-100    | text-blue-800    | bg-blue-500    |
| confirmed    | Bestätigt         | #6366F1  | Indigo        | bg-indigo-100  | text-indigo-800  | bg-indigo-500  |
| in_progress  | Unterwegs         | #F59E0B  | Amber         | bg-amber-100   | text-amber-800   | bg-amber-500   |
| picked_up    | Abgeholt          | #F97316  | Orange        | bg-orange-100  | text-orange-800  | bg-orange-500  |
| arrived      | Angekommen        | #14B8A6  | Teal          | bg-teal-100    | text-teal-800    | bg-teal-500    |
| completed    | Abgeschlossen     | #16A34A  | Green         | bg-green-100   | text-green-800   | bg-green-600   |
| cancelled    | Storniert         | #94A3B8  | Slate         | bg-slate-100   | text-slate-600   | bg-slate-400   |
| rejected     | Abgelehnt         | #EF4444  | Red           | bg-red-100     | text-red-800     | bg-red-500     |
| no_show      | Nicht erschienen  | #E11D48  | Rose          | bg-rose-100    | text-rose-800    | bg-rose-600    |

**Systemalarm (kein Ride-Status):**

| Token           | Hex      | Tailwind       | Verwendung                                   |
|-----------------|----------|----------------|----------------------------------------------|
| status-urgent   | #DC2626  | red-600        | Systemwarnungen, unbesetzte dringende Fahrten|

**Kontrast-Verifikation (WCAG AA = 4.5:1 für Normaltext):**

Alle Badge-Kombinationen (bg-*-100 + text-*-800) erzielen ≥ 5.5:1 Kontrast.
Schwächste Kombination: cancelled (bg-slate-100 + text-slate-600) = 5.2:1 — AA bestanden.

**Map-Integration:**
Google Maps Standard-Style bleibt unverändert (keine Custom Map-Farbe in Phase 1).
Die Neutralität der UI-Umgebung (weiß, grau-50) lässt die Karte optisch einbetten.
Karten-Marker nutzen die Statusfarben für Dot-Marker auf dem Kartencanvas.

### D) Fokus / Outline / Selection

- Focus ring: `focus-visible:ring-1 focus-visible:ring-ring` (shadcn Standard, `--ring` = near-black)
- Selection highlight: Browser-Standard (keine Überschreibung)
- Active nav item: `text-foreground font-medium` vs. `text-muted-foreground` (inaktiv)
- Hover auf Tabellenzeile: `hover:bg-muted/50` (leichtes grau)
- Hover auf Ride-Card in Liste: `hover:bg-gray-50` + Box-Shadow-Erhöhung (`shadow-sm`)

---

## 4. Spacing, Radius, Shadow, Grid

### Spacing-Scale

Basis: Tailwind 4px Grid. Konsistente Verwendung:

| Zweck                          | Wert         | Tailwind              |
|--------------------------------|--------------|-----------------------|
| Innerhalb Badge                | 4px / 8px    | `px-2 py-0.5`         |
| Card-Innenabstand              | 16px         | `p-4`                 |
| Card-Innenabstand (groß)       | 24px         | `p-6`                 |
| Tabellenzelle                  | 12px / 16px  | `px-4 py-3`           |
| Formular-Feld Gap              | 16px         | `gap-4`               |
| Formular-Sections Gap          | 24px         | `gap-6`               |
| Seitenabstand (Standard-Layout)| 16–32px      | `px-4 sm:px-6 lg:px-8`|
| Seitenabstand (Planung-Layout) | 0            | kein padding          |
| Zwischen-Sektionen auf der Seite| 32px        | `py-8`                |
| Ride-Card Abstand untereinander| 1px          | `divide-y divide-border`|
| Icon + Label Gap               | 8px          | `gap-2`               |
| Icon-Button Innenabstand       | 8px          | `p-2`                 |

### Border-Radius ("Uber-like")

Prinzip: abgerundet, nicht rund. Professionell, nicht verspielt.

| Element                        | Radius       | Tailwind     | CSS var            |
|--------------------------------|--------------|--------------|--------------------|
| Karten, Panels, Dialoge        | 8px          | `rounded-lg` | `var(--radius)`    |
| Buttons, Inputs, Selects       | 6px          | `rounded-md` | `calc(var(--radius) - 2px)` |
| Badges, Chips, Tags            | 6px          | `rounded-md` | `calc(var(--radius) - 2px)` |
| Kleine Tags                    | 4px          | `rounded-sm` | `calc(var(--radius) - 4px)` |
| Avatar / Driver-Chip           | 50%          | `rounded-full` | —                |
| Ride-List-Row (linke Kante)    | 0            | kein Radius  | Left-Border, kein Radius |

### Schatten (soft, sparsam)

Schatten werden selten und nur funktional eingesetzt.

| Ebene                         | Klasse          | Wann                                              |
|-------------------------------|-----------------|---------------------------------------------------|
| Standard Card / Panel         | `shadow-sm`     | Cards, Panels im Ruhe-Zustand                     |
| Hover / Fokus auf Card        | `shadow-md`     | Hover auf Ride-Card in der Liste                  |
| Dialog / Modal                | `shadow-xl`     | shadcn Dialog (Standard beibehalten)              |
| Dropdown / Popover            | `shadow-lg`     | shadcn Dropdown (Standard beibehalten)            |
| Bottom Sheet (Driver)         | `shadow-2xl`    | Driver-Screen: Action Card schiebt sich hoch      |
| Kein Schatten                 | —               | Tabellen, Form-Elemente, Badges                   |

Kein `drop-shadow`, kein `box-shadow` auf Text.

### Standard Layout Grid

**Operator Desktop (Dispositonsansicht) — Full-Width Split:**

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  HEADER — h-14 (56px), border-b, bg-white, px-4                             │
│  [Logo/Name]      [Nav Links]                         [User Menu]            │
└──────────────────────────────────────────────────────────────────────────────┘
│                                                                              │
│  ┌────────────────────┐  ┌───────────────────────────────────────────────┐  │
│  │  LEFT PANEL        │  │  RIGHT PANEL (Map)                            │  │
│  │  w-[380px]         │  │  flex-1                                       │  │
│  │  h-[calc(100vh-56px)]  │  h-[calc(100vh-56px)]                        │  │
│  │  overflow-y-auto   │  │  overflow-hidden                              │  │
│  │  border-r          │  │  Google Maps (h-full w-full)                  │  │
│  └────────────────────┘  └───────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Tailwind-Layout-Klassen:**

```tsx
// Outer container:
<div className="flex h-screen flex-col">

// Header:
<header className="h-14 shrink-0 border-b bg-white">

// Split body:
<div className="flex flex-1 overflow-hidden">

// Left panel:
<aside className="w-[380px] shrink-0 overflow-y-auto border-r bg-white">

// Right panel (map):
<main className="flex-1 overflow-hidden">
  <div className="h-full w-full"> {/* Google Maps container */}
```

**Responsive Breakpoints (Operator):**

| Breakpoint  | Left Panel    | Map         |
|-------------|---------------|-------------|
| ≥ 1920px    | 380px         | flex-1      |
| ≥ 1440px    | 340px         | flex-1      |
| ≥ 1280px    | 300px         | flex-1      |
| < 1024px    | 100% (full)   | Versteckt   |

Responsive via CSS: `xl:w-[380px] lg:w-[300px]`

**Standard CRUD-Layout (Fahrten, Fahrer, Patienten, Ziele):**

```tsx
<div className="min-h-screen bg-gray-50">
  <header className="h-14 border-b bg-white">
    <div className="mx-auto flex h-full max-w-7xl items-center px-4 sm:px-6 lg:px-8">
  </header>
  <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
```

**Driver Mobile View — Map + Bottom Sheet:**

```
┌─────────────────────┐  390px × 844px
│                     │
│                     │
│   GOOGLE MAPS       │  h-[55dvh]
│   (Route visible)   │
│                     │
│  [A] ──────── [B]   │
│                     │
├─────────────────────┤  ← bottom sheet start
│  NÄCHSTE FAHRT      │
│                     │
│  07:15              │  text-5xl font-bold tabular-nums
│  Abholzeit          │
│                     │
│  Klinikum Nord      │  text-lg font-semibold
│  Musterstr. 12      │
│  München            │
│                     │
│  [ABFAHRT BESTÄT.]  │  h-16 (64px) full-width primary button
│                     │
│  [Details] [Navi]   │  h-11 (44px) ghost buttons
└─────────────────────┘
```

Bottom Sheet: `fixed bottom-0 left-0 right-0 rounded-t-2xl bg-white shadow-2xl`

---

## 5. Core Components

### Button

**Basis:** shadcn/ui `<Button>` (bereits installiert)
**Varianten und Klassen:**

| Variante     | Tailwind (via shadcn variant)  | Verwendung                         | Deutsche Beispiele               |
|--------------|-------------------------------|------------------------------------|----------------------------------|
| Primary      | `variant="default"`           | Primäraktion, ein pro Seite        | Speichern, Fahrt erstellen       |
| Secondary    | `variant="secondary"`         | Sekundäraktion                     | Abbrechen, Zurück                |
| Ghost        | `variant="ghost"`             | Tabulierte Navigation, Icon-Buttons| Details, Navigation              |
| Destructive  | `variant="destructive"`       | Irreversible Aktionen, im Dialog   | Löschen, Stornieren bestätigen   |
| Outline      | `variant="outline"`           | Filter-Chips, Toggle-Buttons       | Alle, Heute, Aktiv               |

**Größen:**
- Standard: `size="default"` — h-9 (36px) — Operator-Desktop
- Groß: `size="lg"` — h-11 (44px) — Formulare, wichtige Aktionen
- Driver-Primäraktion: `className="h-16 w-full text-base font-semibold"` — kein Standard-Size
- Icon-Button: `size="icon"` — h-9 w-9 — Symbolbuttons ohne Label

**States:**
- Default: shadcn Standard
- Hover: `hover:bg-primary/90` (shadcn Standard)
- Loading: SubmitButton-Komponente mit Loader2-Icon + `disabled`
- Disabled: `disabled:opacity-50 disabled:cursor-not-allowed` (shadcn Standard)

**SubmitButton (shared component):**

```tsx
// src/components/shared/submit-button.tsx
'use client'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </Button>
  )
}
```

### Badge / Status-Pill

**Basis:** shadcn/ui `<Badge>` + custom RIDE_STATUS_COLORS

**RideStatusBadge:**

```tsx
// src/components/shared/ride-status-badge.tsx
import { cn } from '@/lib/utils'
import {
  RIDE_STATUS_COLORS,
  RIDE_STATUS_DOT_COLORS,
  RIDE_STATUS_LABELS,
} from '@/lib/rides/constants'
import type { Enums } from '@/lib/types/database'

type RideStatus = Enums<'ride_status'>

export function RideStatusBadge({ status }: { status: RideStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium',
        RIDE_STATUS_COLORS[status]
      )}
    >
      <span
        className={cn('h-1.5 w-1.5 rounded-full', RIDE_STATUS_DOT_COLORS[status])}
        aria-hidden="true"
      />
      {RIDE_STATUS_LABELS[status]}
    </span>
  )
}
```

**ActiveBadge:**

```tsx
// src/components/shared/active-badge.tsx
import { Badge } from '@/components/ui/badge'

export function ActiveBadge({ isActive }: { isActive: boolean }) {
  return (
    <Badge
      className={
        isActive
          ? 'bg-green-100 text-green-800 border-transparent hover:bg-green-100'
          : 'bg-gray-100 text-gray-500 border-transparent hover:bg-gray-100'
      }
    >
      {isActive ? 'Aktiv' : 'Inaktiv'}
    </Badge>
  )
}
```

### Card (Ride Card — Operator Liste)

Anatomy:
```
┌── border-l-4 [status-color] ────────────────────────────────────┐
│  [Zeit: 07:15]            [Patient: Müller, H.]       [⋮ Menu]  │
│  [Klinikum Nord · Hinfahrt]                                     │
│  [Fahrer: Weber  ✓]  oder  [Kein Fahrer  [Zuweisen]]           │
│  [BADGE: Geplant]                                               │
└─────────────────────────────────────────────────────────────────┘
```

Klassen:
```tsx
<div className={cn(
  "flex flex-col gap-1.5 border-b border-l-4 p-3 hover:bg-gray-50 cursor-pointer transition-colors",
  RIDE_STATUS_BORDER_COLORS[ride.status],
  isSelected && "bg-blue-50"
)}>
  {/* Zeile 1: Zeit + Name + Menu */}
  <div className="flex items-center justify-between gap-2">
    <span className="text-base font-semibold tabular-nums">{ride.pickup_time}</span>
    <span className="text-sm font-medium flex-1">{patient.last_name}, {patient.first_name[0]}.</span>
    <DropdownMenu>...</DropdownMenu>
  </div>
  {/* Zeile 2: Ziel + Richtung */}
  <p className="text-xs text-muted-foreground">
    {destination.name} · {RIDE_DIRECTION_LABELS[ride.direction]}
  </p>
  {/* Zeile 3: Fahrer */}
  <div className="flex items-center gap-2">
    {ride.driver_id ? (
      <span className="text-xs">{driver.first_name} {driver.last_name}</span>
    ) : (
      <>
        <span className="text-xs font-medium text-red-600">Kein Fahrer</span>
        <Button size="sm" variant="outline" className="h-6 text-xs px-2">Zuweisen</Button>
      </>
    )}
  </div>
  {/* Zeile 4: Status Badge */}
  <RideStatusBadge status={ride.status} />
</div>
```

### List Row (Standard-Tabellen — CRUD-Views)

```tsx
<TableRow className={cn(
  "border-l-4",
  RIDE_STATUS_BORDER_COLORS[ride.status]
)}>
  <TableCell className="font-semibold tabular-nums">{ride.pickup_time}</TableCell>
  <TableCell>{patient.last_name}, {patient.first_name}</TableCell>
  <TableCell><RideStatusBadge status={ride.status} /></TableCell>
  <TableCell className="text-muted-foreground">{destination.name}</TableCell>
  <TableCell>
    <DropdownMenu>...</DropdownMenu>
  </TableCell>
</TableRow>
```

### Form Elements

**Basis:** shadcn/ui Input, Select, Textarea, Checkbox, Label

Regeln:
- Alle shadcn-Defaults beibehalten (h-9 Input, Radius, Border)
- Fehler-Text: `text-xs text-destructive mt-1` unter dem Feld
- Pflicht-Felder: `*` nach Label-Text (kein "Pflichtfeld"-Hinweis)
- Zeit-Eingaben: `type="time"` — Browser-Nativ, Mobile-kompatibel
- Datum-Eingaben: `type="date"` — Browser-Nativ
- Placeholder: immer `text-muted-foreground`-Farbe (shadcn Standard)

**Form Field Wrapper (Muster):**

```tsx
<div className="space-y-1.5">
  <Label htmlFor="pickup_time">Abholzeit *</Label>
  <Input id="pickup_time" name="pickup_time" type="time" required />
  {error && <p className="text-xs text-destructive">{error}</p>}
</div>
```

**Typische Formularspalten-Breiten:**

| Feldtyp            | Max-Width     |
|--------------------|---------------|
| Zeit, PLZ, Kürzel  | `max-w-[160px]` |
| Name, Straße       | `max-w-[320px]` |
| Select (mittel)    | `max-w-[240px]` |
| Notizen (Textarea) | Volle Breite  |
| Buttons-Zeile      | Volle Breite  |

### Toast / Alert

**Basis:** shadcn/ui Toaster + Toast (in Root Layout mounten)

```tsx
// src/app/layout.tsx — Root Layout
import { Toaster } from '@/components/ui/toaster'
// ...
<body>
  {children}
  <Toaster />
</body>
```

**Verwendungsregeln:**

| Auslöser                       | Toast-Typ   | Auto-Dismiss | Beispiel-Text                         |
|-------------------------------|-------------|--------------|---------------------------------------|
| Erfolgreiche Speicherung       | default     | 3 Sekunden   | "Fahrt wurde gespeichert."            |
| Erfolgreiche Statusänderung    | default     | 3 Sekunden   | "Status auf Unterwegs geändert."      |
| Server-Fehler (unkritisch)     | destructive | manuell      | "Fehler beim Speichern. Bitte erneut versuchen." |
| Validierungsfehler             | kein Toast  | —            | Inline-Fehler unter dem Feld          |

**Destruktive Operationen (Confirm Dialog):**

```tsx
// Stornieren einer Fahrt
<Dialog>
  <DialogTrigger>
    <Button variant="destructive" size="sm">Stornieren</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Fahrt stornieren?</DialogTitle>
      <DialogDescription>
        Diese Aktion kann nicht rückgängig gemacht werden.
        Die Fahrt wird als "Storniert" markiert.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline">Abbrechen</Button>
      <Button variant="destructive">Stornieren</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Tabs / Filter-Chips (Statusfilter)

Für die Fahrtenliste: Filter-Chips oberhalb der Tabelle.

```tsx
// Variante A: shadcn Tabs-Komponente
<Tabs defaultValue="all">
  <TabsList>
    <TabsTrigger value="all">Alle</TabsTrigger>
    <TabsTrigger value="unplanned">Ungeplant</TabsTrigger>
    <TabsTrigger value="active">Aktiv</TabsTrigger>
    <TabsTrigger value="completed">Abgeschlossen</TabsTrigger>
  </TabsList>
</Tabs>

// Variante B: Toggle-Buttons (kompakter für Disponenten)
// Empfohlen für die linke Panel-Filterleiste
<div className="flex gap-1.5 flex-wrap">
  {statuses.map(status => (
    <button
      key={status}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium border transition-colors",
        active === status
          ? RIDE_STATUS_COLORS[status]
          : "border-border text-muted-foreground hover:bg-muted"
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", RIDE_STATUS_DOT_COLORS[status])} />
      {RIDE_STATUS_LABELS[status]}
    </button>
  ))}
</div>
```

### Empty State

```tsx
// src/components/shared/empty-state.tsx
import { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: { label: string; href: string }
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 rounded-full bg-muted p-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mb-1 text-base font-semibold">{title}</h3>
      <p className="mb-4 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && (
        <Button asChild variant="default">
          <a href={action.href}>{action.label}</a>
        </Button>
      )}
    </div>
  )
}

// Verwendung:
<EmptyState
  icon={Car}
  title="Keine Fahrten für heute"
  description="Für diesen Tag sind keine Fahrten geplant."
  action={{ label: "Neue Fahrt erstellen", href: "/rides/new" }}
/>
```

---

## 6. Map Integration Pattern

### Kernprinzip

Die Karte ist strukturell, nicht supplemental. Sie ist Teil des Layout-Grids.
Sie wird NICHT in einer Card-Komponente gemountet. Sie wird NICHT hinter einem Modal versteckt.

### Layout-Proportionen

| Ansicht                | Liste / Form     | Karte    | Verhalten                        |
|------------------------|------------------|----------|----------------------------------|
| Disposition (Operator) | w-[380px] fixed  | flex-1   | Beide immer sichtbar             |
| Fahrtdetail (Operator) | w-[480px] fixed  | flex-1   | Beide immer sichtbar             |
| Fahrer Mobile          | Bottom 45%       | Top 55%  | Karte verkleinert sich bei Scroll|
| Serienfahrten          | 100% Breite      | Keine    | Reine Datenansicht               |

### Karten-Konfiguration

```tsx
// Bibliothek: @vis.gl/react-google-maps (von Google gepflegt, React-nativ)
// npm install @vis.gl/react-google-maps

// Umgebungsvariable: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local

// src/components/map/dispatch-map.tsx
'use client'
import { Map, AdvancedMarker, APIProvider } from '@vis.gl/react-google-maps'

interface DispatchMapProps {
  rides: RideWithRelations[]
  selectedRideId?: string
  onRideSelect?: (id: string) => void
  className?: string
}

export function DispatchMap({ rides, selectedRideId, onRideSelect, className }: DispatchMapProps) {
  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
      <Map
        className={className}
        defaultCenter={{ lat: 48.137, lng: 11.576 }}  // München (anpassen!)
        defaultZoom={12}
        mapId="dispo-map"
        gestureHandling="greedy"
        disableDefaultUI  // Wir kontrollieren Controls selbst
        zoomControl
      >
        {/* Marker per Fahrt */}
        {rides.map(ride => (
          <RideMarkers
            key={ride.id}
            ride={ride}
            isSelected={ride.id === selectedRideId}
            onSelect={onRideSelect}
          />
        ))}
      </Map>
    </APIProvider>
  )
}

// Operator container:
<div className="h-full w-full">   {/* Parent controls height via flex */}
  <DispatchMap rides={rides} className="h-full w-full" />
</div>

// Driver container:
<div className="h-[55dvh] w-full">
  <DispatchMap rides={[currentRide]} className="h-full w-full" />
</div>
```

### Marker-Spezifikation

- Abholpunkt (A): Weißer Kreis, schwarzer Rand, MapPin-Icon (Lucide) — `text-gray-900`
- Ziel (B): Farbig nach Zieltyp (Klinik = blau, Arzt = violett, Therapie = grün)
- Fahrerposition (Phase 2): Blaues Auto-Icon mit animiertem Puls-Ring

### Routen-Visualisierung

- Einzelfahrt: `strokeColor: '#1a1a1a'`, Breite 4, Opazität 0.8
- Mehrere Fahrten: jede Route bekommt eine Farbe aus der Statuspalette
- Gestrichelt: planned (noch nicht gestartet)
- Durchgezogen: in_progress / picked_up / arrived

### Interaktion Liste ↔ Karte

- Klick auf Ride-Card → Karte zentriert auf diese Fahrt, Route hervorgehoben
- Hover auf Ride-Card → andere Routen: `opacity: 0.2`
- Klick auf Marker → entsprechende Ride-Card wird in der Liste angezeigt / ausgewählt
- Filter-Änderung in Liste → Karte zeigt nur gefilterte Fahrten

### Konflikt-Visualisierung

- Zwei Fahrten für denselben Fahrer mit überlappenden Zeiten:
  - Fahrer-Avatar auf Karte: roter Ring (`border-2 border-red-500 animate-pulse`)
  - Konflikt-Fahrt in Liste: `ride-row-border-urgent` (border-l-4 border-l-red-600)

### Standardansicht

- Default: Nur heutige aktive Fahrten (in_progress, picked_up, arrived) auf Karte
- Alle geplanten Fahrten können über Filter aktiviert werden
- Geclusterte Abholpunkte innerhalb 200m: Cluster-Marker mit Zählbadge

---

## 7. Deutsch als Frontend-Sprache — UI Copy Starter

### Statusbezeichnungen (final)

| DB-Wert     | Label (UI)         | Kurzform (Mobile) |
|-------------|--------------------|--------------------|
| unplanned   | Ungeplant          | Ungeplant          |
| planned     | Geplant            | Geplant            |
| confirmed   | Bestätigt          | Bestätigt          |
| in_progress | Unterwegs          | Unterwegs          |
| picked_up   | Abgeholt           | Abgeholt           |
| arrived     | Angekommen         | Angekommen         |
| completed   | Abgeschlossen      | Fertig             |
| cancelled   | Storniert          | Storniert          |
| rejected    | Abgelehnt          | Abgelehnt          |
| no_show     | Nicht erschienen   | Kein Erscheinen    |

### Navigationslinks

```
Disposition | Fahrten | Fahrer | Patienten | Ziele
```

### Buttons (Operatoren)

```
Speichern       Abbrechen       Bearbeiten
Zuweisen        Stornieren      Bestätigen
Neue Fahrt      Neue Serie      Fahrer hinzufügen
Details         Übersicht       Zurück
```

### Buttons (Driver)

```
Abfahrt bestätigen      (in_progress → confirming pickup start)
Patient abgeholt        (in_progress → picked_up)
Angekommen              (picked_up → arrived)
Fahrt abschließen       (arrived → completed)
Fahrt ablehnen          (assigned → rejected)
```

### Systemmeldungen (Toast/Alert)

| Aktion                     | Meldung                                           |
|----------------------------|---------------------------------------------------|
| Fahrt gespeichert          | "Fahrt wurde gespeichert."                        |
| Status geändert            | "Status auf [Label] geändert."                    |
| Fehler beim Laden          | "Daten konnten nicht geladen werden."             |
| Fehler beim Speichern      | "Fehler beim Speichern. Bitte erneut versuchen."  |
| Fahrt storniert            | "Fahrt wurde storniert."                          |
| Kein Fahrer verfügbar      | "Kein Fahrer für diesen Zeitraum verfügbar."      |
| Ungültige Transition       | "Diese Statusänderung ist nicht möglich."         |
| Validierungsfehler (Feld)  | "Dieses Feld ist erforderlich."                   |
| Zeitkonflikt               | "Fahrer ist zu diesem Zeitpunkt bereits eingeplant." |

### Formularlabels (Standard)

```
Abholzeit *         Abholdatum *        Richtung *
Patient *           Ziel *              Fahrer
Notizen             Aktiv               Fahrzeugart
Vorname *           Nachname *          Telefon
Straße              Hausnummer          PLZ             Stadt
Abteilung
```

### Leere Zustände (Empty States)

```
"Keine Fahrten für diesen Tag."
"Keine Fahrer gefunden."
"Keine Patienten angelegt."
"Keine Ziele vorhanden."
"Keine Ergebnisse für diese Suche."
```

### Ton-Richtlinie

- Sachlich, direkt, kurz. Keine Ausrufezeichen.
- Keine Verniedlichungen ("Hier erscheinen deine Fahrten..." — NICHT so).
- Kein Bürokratendeutsch ("Es wurde eine Fahrt angelegt." — NICHT so).
- Aktiv: "Fahrt gespeichert." statt "Fahrt wurde gespeichert." (beide akzeptabel, Kürze bevorzugt)
- Fehler erklären, nicht anklagen: "Fahrer nicht verfügbar." statt "Fehler: Fahrer bereits gebucht."

---

## 8. Tailwind-Token-Sektion (Implementierungs-Code für Peter)

### globals.css — Vollständige Ergänzung

Die folgenden Tokens wurden zu `/Users/ChristianStebler/Repos/dispo/src/app/globals.css` hinzugefügt:

1. `--status-*` HSL-Tokens in `:root` (10 Statusfarben + urgent)
2. `--panel-ride-list: 380px` und `--header-height: 56px`
3. `font-feature-settings: "tnum"` auf `body` (tabular-nums global)
4. `@layer utilities` mit `.ride-row-border-*` CSS-Utilities (11 Klassen)
5. Dark-Mode Varianten für alle status-Tokens in `.dark`

### tailwind.config.ts — Vollständige Ergänzung

Zu `theme.extend.colors` wurden hinzugefügt:
- `status.*` — 11 Einträge (mapped auf `hsl(var(--status-*))`)
- `panel.*` — Layout-Dimensions-Token (`panel.ride-list = var(--panel-ride-list)`)

### src/lib/rides/constants.ts — Vollständig ersetzt

Enthält jetzt:
- `RIDE_STATUS_LABELS` — 10 deutsche Labels (unverändert)
- `RIDE_DIRECTION_LABELS` — 3 deutsche Labels (unverändert)
- `RIDE_STATUS_COLORS` — Badge bg+text Tailwind-Klassen (korrigiert: cancelled war falsch)
- `RIDE_STATUS_DOT_COLORS` — NEU: Dot-Farben für Badge-Punkt-Indikator
- `RIDE_STATUS_BORDER_COLORS` — NEU: Left-border Klassen für Listenzeilen
- `ACTIVE_RIDE_STATUSES` — NEU: Set mit in_progress, picked_up, arrived
- `ATTENTION_REQUIRED_STATUSES` — NEU: Set mit unplanned, rejected
- `VEHICLE_TYPE_LABELS` — NEU: PKW / Rollstuhlfahrzeug / Liegefahrzeug
- `DESTINATION_TYPE_LABELS` — NEU: Krankenhaus / Arzt / Therapie / Sonstiges

### Noch ausstehende Schritte für Peter (Component-Build-Backlog)

In dieser Reihenfolge bauen:

1. **src/components/shared/submit-button.tsx** — useFormStatus + Loader2 + disabled
2. **src/components/shared/ride-status-badge.tsx** — Dot + Label, nutzt constants.ts
3. **src/components/shared/active-badge.tsx** — grün/grau, nutzt shadcn Badge
4. **src/components/shared/empty-state.tsx** — Icon + Text + optionaler CTA-Button
5. **src/components/shared/address-fields.tsx** — Straße, Hausnummer, PLZ, Stadt (wiederverwendbar)
6. **src/components/dashboard/nav.tsx** — Navigationsleiste mit Links, User-Menu-Platzhalter
7. **src/components/dashboard/page-header.tsx** — Title + optionaler Action-Button
8. **Entity Components** (je nach CRUD-Reihenfolge)
9. **src/components/map/dispatch-map.tsx** — nach `npm install @vis.gl/react-google-maps`

### Layout-Varianten (src/app/(dashboard)/layout.tsx)

Aktuell: eine Layout-Variante mit max-w-7xl.
Benötigt: zwei Varianten. Vorschlag:

```tsx
// src/app/(dashboard)/layout.tsx
// Die Disposition-Route (/) braucht ein Full-Width-Layout ohne max-w-Constraint.
// Alle CRUD-Routen behalten den bestehenden max-w-7xl Container.

// Option A: Layout via searchParam/prop (einfach)
// Option B: Nested Layout — src/app/(dashboard)/(fullwidth)/layout.tsx

// Empfehlung: Option B — nested Route Group
// src/app/(dashboard)/(fullwidth)/page.tsx         → Disposition
// src/app/(dashboard)/(standard)/rides/page.tsx    → Fahrten-Liste
// usw.
// Oder: Disposition auf / als eigene Route Group ohne max-w-Wrapper.
```

---

## 9. Komponenten-Upgrade-Checkliste

### Phase 1 — Foundation (jetzt umsetzbar)

- [x] Status-Tokens in globals.css (DONE)
- [x] Tailwind config mit status.* Mapping (DONE)
- [x] constants.ts mit allen 4 Record Maps (DONE)
- [ ] font-feature-settings "tnum" auf body — in globals.css, aber Inter braucht variables statt className
- [ ] Inter variable = '--font-sans' in layout.tsx setzen
- [ ] Toaster in Root Layout einbinden
- [ ] SubmitButton Komponente
- [ ] RideStatusBadge Komponente
- [ ] ActiveBadge Komponente
- [ ] EmptyState Komponente
- [ ] AddressFields Komponente

### Phase 2 — Map Integration

- [ ] npm install @vis.gl/react-google-maps
- [ ] NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local
- [ ] src/components/map/dispatch-map.tsx
- [ ] Full-Width Layout für Disposition-Route
- [ ] Disposition Page (/) mit Split-Panel
- [ ] Navigation-Umbenennung: "Dashboard" → "Disposition"

### Phase 3 — Polish

- [ ] Dark Mode Aktivierung (Tokens bereits definiert)
- [ ] Google Maps Custom Style (reduzierte POI-Beschriftungen)
- [ ] Konflikt-Visualisierung auf Karte
- [ ] Driver Mobile View
