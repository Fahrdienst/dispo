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

## Existing Codebase State (Session 4 verified — more complete than Session 2 notes)
- src/components/shared/ EXISTS with: active-badge.tsx, address-fields.tsx, empty-state.tsx, location-map.tsx, places-autocomplete.tsx, ride-status-badge.tsx, route-map.tsx, submit-button.tsx
- src/components/ui/ has: badge, button, card, checkbox, dialog, dropdown-menu, input, label, select, skeleton, table, textarea, toast, toaster
- Sheet and AlertDialog NOT yet installed (must run: npx shadcn@latest add sheet alert-dialog)
- globals.css --primary is now hsl(211 96% 42%) — a blue, NOT near-black (MEMORY.md note was outdated)
- glass-panel utility class defined in globals.css @layer components
- PageHeader supports backHref/backLabel (already implemented with glass-panel styling)
- Both destinations-table.tsx and patients-table.tsx exist and are functional tables
- Destinations: has department field (not just contact_person), contact split into contact_first_name + contact_last_name + contact_phone
- Patients: has comment field (in addition to notes), no birth_date in DB type (not in Row — do not reference)

## Card Grid Pattern (Session 4 — /destinations and /patients redesign)
- Layout: table replaced with responsive card grid (1/2/3/4 cols: default/sm/lg/xl)
- Grid class: `grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`
- Card wrapper: `<button>` (not div) for keyboard/click accessibility, full card is click target
- Card styles: `rounded-xl border border-border bg-card shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-150 p-4`
- Inactive cards: `opacity-60` (not hidden by default, hidden via filter)
- Detail view: Sheet (right side, `w-full sm:max-w-xl`) — keeps operator on list, no page nav
- Edit action: navigates to existing `/[id]/edit` page (NOT embedded in Sheet)
- Delete action: in Sheet footer, gated by AlertDialog confirmation
- Toggle active: in Sheet footer left side (secondary, reversible)
- Facility type pills: small colored badges (bg-blue-50/text-blue-700 for hospital, etc.)
- Patient avatar: initials circle `bg-primary/10 text-primary`, `h-9 w-9 rounded-full text-xs font-semibold`
- Impairment badges: icon + label, entity-colored pills inline in card and Sheet
- Section labels in Sheet: `text-xs font-semibold uppercase tracking-wide text-muted-foreground`
- New files: destinations-grid.tsx, destination-detail-sheet.tsx, patients-grid.tsx, patient-detail-sheet.tsx
- Keep old *-table.tsx files until new grid components are confirmed working

## Codebase State (Session 5 re-verified)
- Dashboard layout: sticky dark header (slate-900/85), main content max-w-7xl centered, `glass-panel` class on PageHeader
- Current map tech: Google Maps EMBED API only (iframe), NOT JS API. Two embed components exist: location-map.tsx (single pin) and route-map.tsx (directions)
- /rides page: day-navigation (prev/next/today buttons + ?date= param) + RidesTable (shadcn Table with status filter + search)
- /dispatch page: day-navigation embedded in DispatchBoard component (prev/next/today) + driver sidebar 320px right
- Dashboard page.tsx: very large server component, 21 parallel Supabase queries, 5 rows of stat cards + tables
- deactivate-dialog.tsx now exists in shared/ (not noted in previous sessions)
- DispatchBoard has status filter chips at top (color-coded, count-shown), rides list with border-l-4, 320px driver sidebar card
- `addDays` utility is duplicated in multiple files (rides/page.tsx, dispatch-board.tsx) — not yet consolidated

## Weekly Calendar Design (Session 5 — Design complete)
- See `weekly-calendar-spec.md` for full specification
- /rides weekly view: replaces day-nav with 7-column Mon–Sun grid, each column = date, each cell = compact ride pills
- /dispatch weekly view: same grid but cells differentiated: unassigned = red-left-border, assigned = green-left-border
- Both share a WeekNav component (prev week / week range label / next week / Heute) — URL param `week=YYYY-MM-DD` (Monday's date)
- Week param falls back to current week's Monday if absent
- Ride pill in weekly view: time + patient initials + status color dot — NOT full badge (space constraint)
- Click on day header → navigates to that day's existing day view (/rides?date=...)
- Click on ride pill → navigates to /rides/[id] detail page
- Empty day cell: dashed border, "+ Neue Fahrt" link (staff only)
- Overdue/urgent indicator: red dot badge on day header if any unplanned/rejected rides exist that day
- Driver sidebar on dispatch weekly view: collapsed (not shown in week view — screen too wide to fit meaningfully)

## Dashboard Map Design (Session 5 — Design complete)
- NOT a full-screen takeover — integrated as a new section BELOW existing stat rows
- Map height: 400px fixed on desktop, 280px on mobile
- Implementation: Google Maps Embed API (same as existing components — no JS API needed for multi-pin)
- Multi-pin approach: use `/maps/embed/v1/search` with a place query, OR encode multiple waypoints using the staticmap API
- DECISION: Use Google Maps Static API for the dashboard overview map (supports multiple markers, no iframe interaction needed)
- Static map markers: destinations = blue pin (default), patients with rides today = red pin
- Static map is rendered as <img> not <iframe> — faster, no scrolljacking
- Dashboard map section title: "Heutige Standorte" with a map-pin icon
- Filter toggle above map: "Alle" / "Ziele" / "Patienten" (client-side filter, changes the static map URL)
- Static map size: max 640×400 at 2x scale (stays within Google free tier for low-volume use)
- No marker clustering needed at this scale (Swiss canton geography, typically <50 points)
- Fallback: if no geocoded locations exist, show EmptyState placeholder (no map rendered)
- See `weekly-calendar-spec.md` for implementation notes

## Implementation Status (Session 5 — ALL COMPLETE)
All items from the design spec have been implemented:
1. shadcn sheet + alert-dialog installed
2. Destinations: card grid + detail sheet (destination-card.tsx, destination-detail-sheet.tsx) — DONE
3. Patients: card grid + detail sheet (patient-card.tsx, patient-detail-sheet.tsx) — DONE
4. Rides weekly calendar (rides-week-view.tsx) + week/day URL branching — DONE
5. Dispatch weekly calendar (dispatch-week-view.tsx) + week/day URL branching — DONE
6. Dashboard map (dashboard-map.tsx, Google Maps Static API with retro style, Suspense) — DONE
7. Shared date utils consolidated in src/lib/utils/dates.ts — DONE
8. WeekNav shared component (week-nav.tsx) — DONE
9. DeactivateDialog shared component (deactivate-dialog.tsx) — DONE
