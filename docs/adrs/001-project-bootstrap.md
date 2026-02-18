# ADR 001: Project Bootstrap

## Status

Accepted

## Date

2026-02-18

## Context

We are building "Dispo", a ride service dispatch (Fahrdienst Disposition) application for managing transport operations. The application needs to support admin-only user management, real-time dispatch coordination, and strict data security requirements. The target users are dispatch operators in Germany.

We need to establish the foundational technology stack, project structure, and security baseline before any feature development begins.

## Decision

### Framework and Runtime

- **Next.js 14.2.x** with App Router (not 15, for stability and ecosystem compatibility)
- **React 18.3.x** (aligned with Next.js 14 peer dependency)
- **TypeScript** in strict mode with `noUncheckedIndexedAccess: true`
- **Node.js 25.x** as the development runtime

### Backend and Database

- **Supabase** (hosted in EU Frankfurt) for PostgreSQL database, authentication, and real-time capabilities
- **@supabase/supabase-js 2.x** with **@supabase/ssr 0.8.x** for Next.js integration
- Three Supabase client configurations: browser, server, and middleware
- Row Level Security (RLS) mandatory for all tables

### Authentication

- Supabase Auth with PKCE flow
- Signups disabled (admin-only user creation)
- Email confirmation enabled

### Styling

- **Tailwind CSS 3.4.x** (not v4, for stability)
- Prepared for shadcn/ui component integration

### Validation

- **Zod** for runtime validation at API and Server Action boundaries

### Linting

- **ESLint 8** with eslint-config-next (not ESLint 9, for compatibility)

### Project Structure

```
src/
  app/           # Next.js App Router
    (auth)/      # Authentication route group
    (dashboard)/ # Authenticated dashboard route group
  components/
    ui/          # Reusable UI components (shadcn/ui ready)
  lib/
    supabase/    # Supabase client configurations
    types/       # TypeScript type definitions
  actions/       # Server Actions
supabase/
  migrations/    # SQL migrations (YYYYMMDD_HHMMSS_description.sql)
docs/
  adrs/          # Architecture Decision Records
```

### Security Headers

Applied via `next.config.ts` to all routes:

- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()
- Strict-Transport-Security: max-age=63072000; includeSubDomains; preload

### Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL` — client-safe Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — client-safe anon key (RLS is the security boundary)
- `SUPABASE_SERVICE_ROLE_KEY` — server-only, never prefixed with NEXT_PUBLIC_
- `NEXT_PUBLIC_APP_URL` — application base URL

### Deployment

- **Vercel** for hosting and CI/CD
- `.gitignore` created as first file to prevent accidental secret exposure

## Consequences

### Positive

- Stable, well-tested technology choices reduce risk of breaking changes
- Strict TypeScript catches type errors at compile time
- RLS-first approach ensures security is not an afterthought
- EU Frankfurt hosting addresses data residency requirements
- Admin-only user creation eliminates unauthorized access risks
- Security headers provide defense-in-depth against common web vulnerabilities

### Negative

- Next.js 14 will eventually need migration to 15 (planned, not urgent)
- Tailwind CSS 3 will eventually need migration to v4 (can be done incrementally)
- ESLint 8 is in maintenance mode (migration to 9 when ecosystem catches up)
- Manual project scaffolding requires more initial setup than create-next-app

### Risks

- Supabase SDK version updates may require client code changes
- Three separate Supabase client configurations add maintenance overhead

## References

- [Next.js 14 Documentation](https://nextjs.org/docs)
- [Supabase SSR Guide](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Tailwind CSS v3 Documentation](https://v3.tailwindcss.com/)
