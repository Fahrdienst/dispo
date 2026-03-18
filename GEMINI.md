# Fahrdienst / Dispo Application Context

This `GEMINI.md` file provides context, conventions, and guidelines for working on the Fahrdienst (Dispo) application. It is the primary source of truth for the AI assistant regarding project structure and coding standards.

## 1. Project Overview

- **Name:** Fahrdienst (Internal name: `dispo`)
- **Purpose:** Dispatch and management system for a driving service, handling rides, drivers, patients, and billing.
- **Tech Stack:**
  - **Framework:** Next.js 14 (App Router)
  - **Language:** TypeScript
  - **Styling:** Tailwind CSS, Shadcn UI (Radix UI), Framer Motion
  - **Backend/Database:** Supabase (PostgreSQL, Auth, Realtime)
  - **Maps:** Google Maps Platform (`@vis.gl/react-google-maps`)
  - **Testing:** Vitest
  - **Email:** Nodemailer

## 2. Directory Structure

The project follows a standard Next.js App Router structure within a `src` directory:

- **`src/app`**: Next.js pages and layouts (App Router).
  - `(auth)`: Authentication-related routes (login, etc.).
  - `(dashboard)`: Protected dashboard routes.
  - `api`: API routes (if any, prefer Server Actions).
- **`src/actions`**: Server Actions for data mutations and backend logic.
- **`src/components`**: React components.
  - `ui`: Reusable UI components (Shadcn UI).
  - Feature-specific folders (e.g., `drivers`, `rides`, `billing`).
- **`src/lib`**: Utilities and configurations.
  - `supabase`: Supabase client configuration (Client & Server).
  - `types`: TypeScript type definitions (including database types).
  - `utils.ts`: Utility functions (cn, etc.).
- **`src/hooks`**: Custom React hooks.
- **`supabase`**: Supabase configuration.
  - `migrations`: SQL migration files.
  - `seed`: Seed data.

## 3. Coding Conventions & Standards

### 3.1. General
- **TypeScript:** Strict mode is enabled. No `any`. Use proper typing for all props and return values.
- **Imports:** Use absolute imports with `@/` alias (configured in `tsconfig.json`).
- **Environment Variables:** Access via `process.env`. Ensure strict typing where possible.

### 3.2. Components (React/Next.js)
- **Server Components:** Default to Server Components. Use `'use client'` only when interactivity (state, effects, event listeners) is required.
- **Shadcn UI:** Use the existing components in `src/components/ui`. extend or customize them via `props` or `className` (using `cn()` utility).
- **Icons:** Use `lucide-react`.

### 3.3. Data Fetching & State
- **Server Actions:** Use Server Actions (`src/actions`) for all mutations (CREATE, UPDATE, DELETE) and sensitive data fetching.
- **Supabase SSR:** Use `@supabase/ssr` packages.
  - Client Component: `createBrowserClient`
  - Server Component/Action: `createServerClient`
- **Validation:** Use `zod` for validating form data and API inputs.

### 3.4. Database (Supabase)
- **Schema:** Managed via SQL migrations in `supabase/migrations`.
- **Types:** Generated automatically. Do not manually type database tables. Use `Database` type from `@/lib/types/database`.
- **Row Level Security (RLS):** Always enabled. Policies define access control.

### 3.5. Styling
- **Tailwind CSS:** Primary styling method. Use utility classes.
- **CSS Variables:** Used for theming (colors, radius) in `globals.css`.
- **Responsiveness:** Mobile-first approach.

## 4. Workflows

### 4.1. Database Updates
1.  Create a migration file in `supabase/migrations`.
2.  Apply migration locally or on the Supabase project.
3.  Update types: `npm run db:types`.

### 4.2. Testing
- Run tests: `npm test` (Vitest).
- Write tests for critical logic and utility functions.

## 5. Key Commands

- `npm run dev`: Start development server.
- `npm run db:types`: Generate TypeScript types from Supabase.
- `npm test`: Run tests.

## 6. Documentation
- Refer to `docs/` for detailed architectural decisions (ADRs) and feature specifications.
- `docs/adrs`: Architecture Decision Records.
