# Supabase Directory Context

This `GEMINI.md` provides specific guidelines for the `supabase` directory, focusing on database migrations, seeding, and security policies.

## 1. Migrations

- **Naming Convention:** `YYYYMMDD_######_description.sql` (e.g., `20240320_000001_create_rides_table.sql`).
- **Idempotency:** Migrations should be idempotent if possible, or assume they run sequentially once.
- **Rollback:** Always plan for rollback. If a migration fails, the database state should be clean.

## 2. Security (RLS)

- **Row Level Security (RLS):** MUST be enabled on ALL tables.
- **Policies:** Explicitly define policies for `SELECT`, `INSERT`, `UPDATE`, `DELETE`.
  - Prefer `auth.uid()` based checks.
  - Use helper functions in `public` schema if logic is complex (e.g., role checks).
- **Service Role:** Only use the service role key for administrative tasks or background jobs that bypass RLS intentionally.

## 3. Workflow

1.  **Draft Migration:** Create a new SQL file in `migrations/`.
2.  **Apply Local:** Test migration locally or on a development instance.
3.  **Generate Types:** Run `npm run db:types` in the project root to update TypeScript definitions.
4.  **Commit:** Commit migration file and updated types.

## 4. Seeding

- **Seed Data:** Located in `seed/`.
- **Purpose:** Provide initial data for development and testing (e.g., test users, initial configuration).
- **Format:** SQL `INSERT` statements.
