# Teststrategie & E2E-Abdeckung

## Test-Framework

- **Vitest** (konfiguriert in `vitest.config.ts`)
- Path-Alias `@/*` -> `./src/*` ist in der Vitest-Config aufgeloest
- Tests liegen immer in `__tests__/`-Ordnern neben dem Quellcode

## Tests ausfuehren

```bash
# Alle Tests einmalig ausfuehren
npm test

# Tests im Watch-Modus (Entwicklung)
npm run test:watch

# Coverage-Report generieren
npx vitest run --coverage
```

## Test-Architektur

### Unit-Tests (reine Funktionen, kein Mock noetig)

| Modul | Testdatei | Was wird getestet |
|-------|-----------|-------------------|
| Zeitberechnung | `src/lib/rides/__tests__/time-calc.test.ts` | `calculateRideTimes()`, `detectTimeConflicts()` |
| Status-Maschine | `src/lib/rides/__tests__/status-machine.test.ts` | `canTransition()`, `canTransitionForRole()`, `assertTransition()` |
| Serienfahrt-Generierung | `src/lib/ride-series/__tests__/generate.test.ts` | `generateDatesForSeries()`, `expandDirections()` |
| Preisberechnung | `src/lib/billing/__tests__/calculate-price.test.ts` | Preiskalkulation mit Zonen/Tarifen |
| Zonen-Lookup | `src/lib/billing/__tests__/zone-lookup.test.ts` | Zonen-Zuordnung nach PLZ |
| Akzeptanz-Engine | `src/lib/acceptance/__tests__/engine.test.ts` | Regel-Engine fuer Fahrtannahme |
| Akzeptanz-Konstanten | `src/lib/acceptance/__tests__/constants.test.ts` | Konfigurationswerte |
| UUID-Validierung | `src/lib/validations/__tests__/shared.test.ts` | `uuidSchema` mit gueltigen/ungueltigen UUIDs |
| Rate Limiting | `src/lib/security/__tests__/rate-limit.test.ts` | `rateLimit()`, Window-Reset, pre-configured Limiters |

### Validierungs-Tests (Zod-Schemas)

| Schema | Testdatei |
|--------|-----------|
| Rides | `src/lib/validations/__tests__/rides.test.ts` |
| Patients | `src/lib/validations/__tests__/patients.test.ts` |
| Drivers | `src/lib/validations/__tests__/drivers.test.ts` |
| Destinations | `src/lib/validations/__tests__/destinations.test.ts` |
| Users | `src/lib/validations/__tests__/users.test.ts` |
| Zones | `src/lib/validations/__tests__/zones.test.ts` |
| Fares | `src/lib/validations/__tests__/fares.test.ts` |
| Availability | `src/lib/validations/__tests__/availability.test.ts` |
| Acceptance | `src/lib/validations/__tests__/acceptance.test.ts` |
| Shared (UUID) | `src/lib/validations/__tests__/shared.test.ts` |

### Integrations-Tests (mit Supabase-Mocks)

| Modul | Testdatei | Was wird getestet |
|-------|-----------|-------------------|
| Ride-Statuswechsel | `src/actions/__tests__/rides.test.ts` | `updateRideStatus()` — Auth, State-Machine, DB-Update |
| GDPR-Anonymisierung | `src/actions/__tests__/gdpr.test.ts` | `anonymizePatient()`, `anonymizeDriver()` — Auth, Validierung, RPC |
| Audit Logger | `src/lib/audit/__tests__/logger.test.ts` | `logAudit()` — Insert, Error-Handling (wirft nie) |

### Maps & Geocoding Tests

| Modul | Testdatei |
|--------|-----------|
| Geocoding | `src/lib/maps/__tests__/geocode.test.ts` |
| Directions | `src/lib/maps/__tests__/directions.test.ts` |
| Places | `src/lib/maps/__tests__/places.test.ts` |

### Mail-Template Tests

| Modul | Testdatei |
|--------|-----------|
| Order Sheet | `src/lib/mail/__tests__/order-sheet.test.ts` |
| Templates | `src/lib/mail/__tests__/templates.test.ts` |
| Token-Generierung | `src/lib/mail/__tests__/tokens.test.ts` |
| Mail-Utilities | `src/lib/mail/__tests__/utils.test.ts` |

## Mock-Strategie

### Supabase Client
Server Actions erstellen ihren eigenen Supabase-Client. In Tests wird dieser per `vi.mock()` ersetzt:

```typescript
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnValue({ ... }),
  }),
}))
```

Fuer Admin-Operationen (Audit, GDPR):
```typescript
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn().mockReturnValue({ ... }),
  })),
}))
```

### Auth Guards
```typescript
vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: vi.fn(),
}))
```

### Next.js APIs
```typescript
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))
```

### Google Maps
Maps-Funktionen werden per Mock ersetzt, da sie externe API-Calls machen.

## Abdeckungs-Bereiche

### Gut abgedeckt
- Ride-Zeitberechnung (Pickup, Return, Konflikte)
- Status-Maschine (alle Uebergaenge, rollenbasiert)
- Serienfahrt-Generierung (daily, weekly, biweekly, monthly)
- Alle Zod-Validierungsschemas
- Preisberechnung und Zonen-Lookup
- Rate Limiting (Limits, Window-Reset, pre-configured)
- Audit Logging (Fehlerresistenz)
- GDPR Actions (Auth, Validierung, Fehlerfaelle)
- Mail-Templates und Utilities
- Geocoding und Places-Fallback

### Nicht abgedeckt (bewusste Entscheidung)
- **React-Komponenten**: Kein Component-Testing (wuerde React Testing Library benoetigen)
- **E2E-Tests**: Kein Playwright/Cypress Setup (spaeterer Milestone)
- **Supabase RLS-Policies**: Werden durch manuelle Tests und die SQL-Migrationen sichergestellt
- **Middleware**: Auth-Middleware wird implizit durch die Auth-Guards getestet

## Hinweise fuer neue Tests

1. **Reine Funktionen bevorzugen**: Tests fuer reine Funktionen sind am stabilsten und schnellsten
2. **Mocks sparsam einsetzen**: Nur externe Dependencies (Supabase, Maps API) mocken
3. **`vi.hoisted()` verwenden**: Wenn Mock-Variablen in `vi.mock()`-Factories gebraucht werden
4. **`beforeEach(() => vi.clearAllMocks())`**: In jeder Describe-Block mit Mocks
5. **Discriminated Unions testen**: Immer `result.success` pruefen bevor auf `.data` oder `.error` zugegriffen wird
6. **Edge Cases**: Leere Strings, null, undefined, Grenzwerte immer mittesten
7. **Error-Pfade**: Jeden Error-Branch explizit testen, nicht nur den Happy Path
