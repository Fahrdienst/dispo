# Project Bootstrap Details

## Verified Package Versions (2026-02-18)
- next: 14.2.35 (latest 14.x)
- react/react-dom: 18.3.1
- @supabase/supabase-js: 2.97.0
- @supabase/ssr: 0.8.0
- tailwindcss: 3.4.19
- zod: 3.x (4.x not yet used)
- typescript: 5.7.x
- eslint: 8.57.x (not 9 -- eslint-config-next compat)
- Node.js: 25.4.0, npm: 11.7.0

## Environment Variables
- NEXT_PUBLIC_SUPABASE_URL -- safe to expose
- NEXT_PUBLIC_SUPABASE_ANON_KEY -- safe to expose (RLS is the boundary)
- SUPABASE_SERVICE_ROLE_KEY -- server only, never NEXT_PUBLIC_
- NEXT_PUBLIC_APP_URL -- base URL for callbacks

## Tailwind v3 vs v4 Decision
- v4 drops tailwind.config.ts for CSS-first config
- v4 plugin ecosystem still migrating
- v4 shadcn/ui support still catching up
- Decision: v3.4.x now, migrate to v4 when ecosystem stabilizes

## Next.js 14 vs 15 Decision
- 15 introduces async request APIs (breaking change)
- 15 requires React 19 (some libs not compatible)
- 15 changes caching defaults
- Decision: 14.2.x now, migrate with codemods when ready
