# Kim - UX Designer Memory

## Project: FAHRDIENST APP

## Core Design Direction (Established Session 1)
- Design language: calm, structured, map-centric, operationally confident
- Reference feel: Uber clarity adapted to healthcare-adjacent dispatch context
- NOT decorative — every decision must serve operational speed and error prevention
- See `design-system.md` for the full foundational design document

## Implementation Status (Session 2 — COMPLETE)
- globals.css: fully rewritten with status tokens + layout tokens + ride-row-border utilities
- tailwind.config.ts: extended with `status.*` and `panel.*` color/width tokens
- src/lib/rides/constants.ts: fully rewritten with all 4 record maps + helper sets
- See `implementation-files.md` for exact file contents summary

## Typography Decision (Locked)
- Primary font: Inter (Google Fonts) — already in layout.tsx via next/font/google
- No secondary font — Inter handles all weights and scales
- Numeric emphasis: `font-feature-settings: "tnum"` on body in globals.css (DONE)
- Time displays: `text-2xl font-semibold tabular-nums` (operator), `text-5xl font-bold tabular-nums` (driver)
- CSS variable: not needed — Inter loaded via next/font/google, applies via inter.className

## Color System (Locked, fully implemented)
- Base: shadcn/ui neutral (in globals.css :root) — white backgrounds, near-black text
- Primary action accent: `#171717` (near-black) — existing `--primary`
- Status colors are FUNCTIONAL, never decorative
- All 10 status tokens defined in globals.css :root as `--status-*` HSL values
- Tailwind mapping: `status.*` keys in tailwind.config.ts colors extend
- Badge classes in RIDE_STATUS_COLORS (bg + text), RIDE_STATUS_DOT_COLORS (dot), RIDE_STATUS_BORDER_COLORS (row left-border)
- Key hex values:
  - status-unplanned:   #6B7280 (gray-500)
  - status-planned:     #3B82F6 (blue-500)
  - status-confirmed:   #6366F1 (indigo-500)
  - status-in-progress: #F59E0B (amber-500)
  - status-picked-up:   #F97316 (orange-500)
  - status-arrived:     #14B8A6 (teal-500)
  - status-completed:   #16A34A (green-600)
  - status-cancelled:   #94A3B8 (slate-400)
  - status-rejected:    #EF4444 (red-500)
  - status-no-show:     #E11D48 (rose-600)
  - status-urgent:      #DC2626 (red-600) — alerts only, not a ride status

## Layout Architecture (Established)
- Operator dashboard: sidebar-left (ride list, 380px) + map-right (flex-1) split
- NOT max-w-7xl centered — full-width for planning views
- Standard CRUD pages keep max-w-7xl centered layout (existing pattern preserved)
- Dashboard layout.tsx needs a variant for map-views vs standard views
- See `design-system.md` for ASCII wireframes

## Existing Codebase State (Session 2 verified)
- shadcn/ui: installed, new-york style implied, neutral base, CSS variables, lucide icons
- tailwindcss-animate: installed (in tailwind.config.ts plugins)
- Inter font: already loaded in src/app/layout.tsx via next/font/google
- Status machine: 10 states in src/lib/rides/status-machine.ts
- constants.ts: fully updated with 4 record maps + helper sets + German labels
- NO src/components/shared/ files yet — all shared components still to be created
- NO src/lib/rides/constants.ts had RIDE_STATUS_COLORS before (now done)
- Vehicle types: standard, wheelchair, stretcher
- Entities: rides, drivers, patients, destinations, ride_series (recurring)

## Map Integration Pattern
- Google Maps embedded in layout, not a modal/popup
- Operator view: 40/60 split (list left, map right), map is persistent
- Driver view: map fills top 55% of screen, action card slides up from bottom
- Map markers: color-coded by ride status
- Library: @vis.gl/react-google-maps (not yet installed)
- See `design-system.md` for full map spec

## Component Conventions (Established, not yet built)
- Status badge: `RideStatusBadge` — to be created at src/components/shared/ride-status-badge.tsx
- Uses RIDE_STATUS_COLORS (bg+text) + RIDE_STATUS_DOT_COLORS (dot) from constants.ts
- ActiveBadge: bg-green-100 text-green-800 (active) / bg-gray-100 text-gray-500 (inactive)
- Tables use shadcn Table component with border-b between rows
- Ride list rows: border-l-4 + RIDE_STATUS_BORDER_COLORS, urgent variant = border-l-red-600

## German UI Terms (Confirmed)
- Fahrten = Rides, Fahrer = Drivers, Patienten = Patients, Ziele = Destinations
- Abholzeit = Pickup time, Richtung = Direction
- Hinfahrt / Rückfahrt / Hin & Rück = outbound / return / both
- Status labels: see RIDE_STATUS_LABELS in src/lib/rides/constants.ts
- Vehicle labels: PKW / Rollstuhlfahrzeug / Liegefahrzeug
- Destination labels: Krankenhaus / Arzt / Therapie / Sonstiges

## Email Notification System (Session 3 — Design complete)
- Trigger: Operator assigns driver to ride → driver gets email
- Email content: pickup time (large), patient (firstname + last initial), pickup addr, destination, optional appointment time, return flag, distance/duration, 2 action buttons, 48h expiry notice
- Email tech: React Email (npm @react-email/components) — TypeScript, inline CSS, Nodemailer-compatible
- Email layout: single-column only, table-based, NO flexbox/grid — Gmail compatibility
- Font in email: System font stack (NOT Inter — Gmail blocks web fonts)
- Button hierarchy: "Annehmen" = solid green (#16A34A), "Ablehnen" = outline with #EF4444 border + #B91C1C text (WCAG AA: 5.4:1)
- Ablehnen button text must be #B91C1C NOT #EF4444 (contrast fail on white)
- Expired/invalid link banner: GRAY (not red) — not a user error, no alarm needed
- Rejection result page: intentionally minimal, NO ride summary shown (ride is irrelevant after rejection)
- Result page route: src/app/(public)/rides/respond/page.tsx — single route, state via ?status= query param
- Status values: accepted | rejected | expired | invalid | already_used
- Token URL pattern: /api/rides/respond?token=[TOKEN]&action=accept|reject
- Token must be single-use, invalidated immediately after click
- Email subject pattern: "Neue Fahrt zugewiesen – Di., 24.02.2026, 07:15 Uhr"
- Email template file: src/emails/ride-assigned.tsx
- See design-system.md section 10 for full spec (to be added)

## Next Steps for Peter (Component Build Order)
1. Create src/components/shared/ride-status-badge.tsx (uses constants.ts)
2. Create src/components/shared/active-badge.tsx (green/gray, uses shadcn Badge)
3. Create src/components/shared/submit-button.tsx (spinner + disabled state)
4. Create src/components/shared/empty-state.tsx
5. Create src/components/dashboard/nav.tsx (navigation bar)
6. Create src/components/dashboard/page-header.tsx
7. Entity tables and forms per the CRUD pattern
8. Map integration: install @vis.gl/react-google-maps, build dispatch-map.tsx
9. Email system: npm install @react-email/components react-email, build src/emails/ride-assigned.tsx
