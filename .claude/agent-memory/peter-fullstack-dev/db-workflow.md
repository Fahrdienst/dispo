---
name: db-workflow
description: Worktree toolchain setup (node_modules junction) and how to run M14 DB tests
metadata:
  type: project
---

# Worktree / DB / Test workflow

## node_modules in git worktrees
Worktrees under `.claude/worktrees/<id>/` start WITHOUT `node_modules`. Do NOT run a
full `npm install` — instead junction to the main repo's installed modules:

```powershell
New-Item -ItemType Junction `
  -Path   "C:\GIT\Fahrdienst\.claude\worktrees\<id>\node_modules" `
  -Target "C:\GIT\Fahrdienst\node_modules"
```

Verify with `Test-Path node_modules\.bin\vitest.cmd`. After that `npm test`, `npx tsc`,
`npm run lint`, `npm run build` all work in the worktree.
Package manager: npm (package-lock.json).

## M14 finance tests
- Vitest (JS): `src/lib/receipts/__tests__`, `src/lib/finance/__tests__`,
  `src/actions/__tests__/receipt-*` — run via `npm test`.
- DB-level assertions (Vitest has NO database): `supabase/tests/m14_*.sql`.
  Run against a DB with all migrations applied:
  `psql "$DATABASE_URL" -f supabase/tests/m14_receipts.sql` (or `supabase db execute --file ...`).
  Each script runs in ONE transaction that ROLLS BACK → idempotent, leaves no fixtures.
  Prints `... all passed` on success; a failed assertion aborts with `FAIL: ...`.
