# ADR 006: Fahrer-Selbstverwaltung und Fahrer-Dashboard

## Status

Accepted

## Date

2026-02-20

## Context

Fahrer sollen kuenftig eingeschraenkten Zugang zum System erhalten: eigene Verfuegbarkeit pflegen und eigene Fahrten einsehen. Bisher existiert nur die Staff-Sicht (admin/operator) mit voller Navigation. Fuer die Fahrer-Rolle muss entschieden werden:

1. Wo leben die Fahrer-eigenen Seiten (Route-Struktur)?
2. Wie wird die Navigation rollenbasiert eingeschraenkt?
3. Welche Felder darf ein Fahrer selbst aendern?
4. Was sieht ein Fahrer als Startseite?

Die technische Grundlage (RLS-Policies, Server Actions, Availability-Grid) wurde in M4 (ADR-005) bereits gelegt.

---

## Entscheidung 1: Route-Struktur -- `/my/*` statt rollengefiltertes `/drivers/[id]/*`

### Entscheidung

Fahrer-eigene Seiten erhalten eigene Routes unter dem Praefix `/my/`:

```
/my/availability   -- Eigene Verfuegbarkeit (5x5 Grid)
/my/rides          -- Eigene zugewiesene Fahrten
```

Diese Routes liegen im bestehenden `(dashboard)` Route-Group und teilen Layout + Header.

### Alternativen

- **Option A: `/drivers/[id]/availability` wiederverwenden mit Rollenpruefung** -- Problematisch: URL enthaelt fremde `id`, erfordert ID-Lookup via `driverId` aus Profil, komplexere Autorisierungslogik in jeder Seite.
- **Option B: Eigener `(driver)` Route-Group mit separatem Layout** -- Ueberengineered fuer 2 Seiten, dupliziert Header/Logout-Logik.

### Begruendung

`/my/*` ist semantisch klar, benoetigt keine ID in der URL (wird serverseitig aus `requireAuth` gelesen), und laesst sich im bestehenden Dashboard-Layout einbetten. Spaetere Erweiterungen (`/my/profile`) fuegen sich natuerlich ein.

---

## Entscheidung 2: Rollenbasierte Navigation

### Entscheidung

Die bestehende `DashboardNav`-Komponente erhaelt ein `roles`-Feld pro `navItem` und eine `role`-Prop:

```typescript
type NavItem = {
  href: string
  label: string
  roles?: UserRole[]  // undefined = alle Rollen
}

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", roles: ["admin", "operator"] },
  { href: "/rides", label: "Fahrten", roles: ["admin", "operator"] },
  { href: "/drivers", label: "Fahrer", roles: ["admin", "operator"] },
  { href: "/destinations", label: "Ziele", roles: ["admin", "operator"] },
  { href: "/patients", label: "Patienten", roles: ["admin", "operator"] },
  { href: "/users", label: "Benutzer", roles: ["admin"] },
  { href: "/my/rides", label: "Meine Fahrten", roles: ["driver"] },
  { href: "/my/availability", label: "Meine Verfuegbarkeit", roles: ["driver"] },
]
```

Das Dashboard-Layout (`layout.tsx`) liest die Rolle serverseitig via `requireAuth()` und uebergibt sie als Prop an `DashboardNav`.

### Begruendung

Minimaler Eingriff: bestehende Komponente erweitern statt neue erstellen. Die Rollenpruefung ist nur UI-seitig (Convenience) -- die echte Autorisierung liegt in den Server Actions und RLS-Policies. Ein Fahrer, der manuell `/patients` aufruft, sieht eine leere Liste (RLS blockiert).

---

## Entscheidung 3: Profil-Selbstbearbeitung -- nicht in diesem Meilenstein

### Entscheidung

Fahrer koennen in diesem Meilenstein **nur ihre Verfuegbarkeit** selbst pflegen. Profil-Daten (Name, Adresse, Fahrzeug, Notfallkontakt) werden weiterhin nur durch Staff bearbeitet.

### Begruendung

- Verfuegbarkeit hat eigene RLS-Policies (INSERT/DELETE eigene Slots, ADR-005)
- Profil-Bearbeitung wuerde neue RLS-Policies auf `drivers` erfordern (UPDATE eigenes Profil)
- Scope-Beschraenkung: Verfuegbarkeit + Fahrten-Ansicht sind der Kern-Use-Case fuer Fahrer
- Profil-Selbstbearbeitung kann in einem spaeteren Meilenstein hinzugefuegt werden (`/my/profile`)

---

## Entscheidung 4: Fahrer-Startseite -- Redirect auf `/my/rides`

### Entscheidung

Wenn ein Fahrer die Root-URL `/` aufruft, wird serverseitig auf `/my/rides` weitergeleitet. Staff-Rollen (admin, operator) sehen weiterhin das bestehende Dashboard.

### Implementierung

In `src/app/(dashboard)/page.tsx`:

```typescript
import { requireAuth } from "@/lib/auth/require-auth"
import { redirect } from "next/navigation"

export default async function DashboardPage() {
  const auth = await requireAuth()
  if (auth.authorized && auth.role === "driver") {
    redirect("/my/rides")
  }
  // ... bestehende Dashboard-Logik fuer Staff
}
```

### Begruendung

Fahrer haben keinen Nutzen vom Staff-Dashboard (Tagesstatistiken, ungeplante Fahrten). Die Redirect-Logik ist minimal und liegt an der richtigen Stelle (Server Component, vor Datenbankabfragen).

---

## Betroffene Dateien

### Neue Dateien

| Datei | Zweck |
|-------|-------|
| `src/app/(dashboard)/my/availability/page.tsx` | Eigene Verfuegbarkeit -- laed `driverId` via `requireAuth(["driver"])`, ruft bestehende `AvailabilityGrid` auf |
| `src/app/(dashboard)/my/availability/loading.tsx` | Loading-Skeleton |
| `src/app/(dashboard)/my/rides/page.tsx` | Eigene Fahrten -- Tagesansicht mit Statusuebergaengen |
| `src/app/(dashboard)/my/rides/loading.tsx` | Loading-Skeleton |

### Geaenderte Dateien

| Datei | Aenderung |
|-------|-----------|
| `src/components/dashboard/dashboard-nav.tsx` | `roles`-Feld + `role`-Prop, Filter-Logik |
| `src/app/(dashboard)/layout.tsx` | `requireAuth()` fuer Rolle, Prop an `DashboardNav` |
| `src/app/(dashboard)/page.tsx` | Redirect fuer Driver-Rolle |

### Wiederverwendung

- `src/components/drivers/availability-grid.tsx` -- 1:1 in `/my/availability`
- `src/components/shared/ride-status-badge.tsx` -- in `/my/rides`
- `src/lib/rides/status-machine.ts` -- fuer Statusuebergaenge in `/my/rides`
- `src/actions/availability.ts` -- `saveWeeklyAvailability` bereits RLS-gesichert
- `src/lib/auth/require-auth.ts` -- liefert `role` und `driverId`

---

## Mapping zu Issues

| Issue | Scope |
|-------|-------|
| #35 | Dieses ADR |
| #36 | `/my/availability` + Nav-Aenderung + Layout-Aenderung |
| #37 | `/my/rides` + Redirect in Dashboard-Startseite |

---

## Sicherheitshinweise

- Die Navigation ist nur ein UI-Filter. Die echte Zugriffskontrolle liegt in RLS-Policies und `requireAuth()` in Server Actions.
- Fahrer, die Staff-URLs manuell aufrufen, sehen leere Listen (RLS blockiert SELECT).
- `/my/availability` nutzt die bestehende `saveWeeklyAvailability` Server Action, die intern `requireAuth(["admin", "operator", "driver"])` prueft und fuer Fahrer `get_user_driver_id()` verwendet.
- Statusuebergaenge in `/my/rides` muessen die bestehende Status-Machine (`src/lib/rides/status-machine.ts`) verwenden. Erlaubte Transitions sind rollenbasiert bereits definiert.
