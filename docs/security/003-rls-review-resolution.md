# RLS/Policy Review Resolution — Soll/Ist-Abgleich

**Reviewer:** Ioannis (CISO)
**Date:** 2026-02-19
**Source document:** `docs/security/002-schema-security-review.md`
**Migration files reviewed:**
- `supabase/migrations/20260218_000001_initial_schema.sql`
- `supabase/migrations/20260219_000001_add_email_to_profiles.sql`
- `supabase/migrations/20260219_000002_fix_sec006_destinations_deactivated_users.sql` (this review)

**Classification:** INTERNAL — VERTRAULICH

---

## 1. Finding Status Overview

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| SEC-001 | CRITICAL | Role injection in `handle_new_user()` | **RESOLVED** |
| SEC-002 | CRITICAL | SECURITY DEFINER without `search_path` | **RESOLVED** |
| SEC-003 | HIGH | Driver can update all ride columns | **ACCEPTED RISK** |
| SEC-004 | HIGH | Patient data minimization app-only | **ACCEPTED RISK** |
| SEC-005 | HIGH | Missing `WITH CHECK` on driver update | **RESOLVED** (merged with SEC-003) |
| SEC-006 | HIGH | Deactivated users retain access | **RESOLVED** (migration `20260219_000002`) |
| SEC-007 | MEDIUM | `profiles_insert_admin` blocks trigger | **RESOLVED** |
| SEC-008 | MEDIUM | Soft delete != Art. 17 erasure | **ACCEPTED RISK** |
| SEC-009 | MEDIUM | No audit log | **ACCEPTED RISK** |
| SEC-010 | MEDIUM | `comm_log` INSERT too permissive | **RESOLVED** |
| SEC-011 | MEDIUM | Missing `is_active` on driver rides | **RESOLVED** |
| SEC-012 | LOW | No text length DB constraints | **ACCEPTED RISK** |
| SEC-013 | LOW | Patient notes accessible to drivers | **ACCEPTED RISK** (linked to SEC-004) |
| SEC-014 | LOW | Enum modification complexity | **ACCEPTED** — no action needed |

**Summary:** 8 resolved, 5 accepted risk (MVP), 1 informational (no action needed).

---

## 2. Accepted Risks Register

All accepted risks are conditional on the fact that **no driver-facing UI exists yet** in the MVP. The Supabase anon key is public, but drivers have no application interface to exploit these gaps. When the driver UI sprint begins, these risks must be re-evaluated and mitigated.

| Risk ID | Description | Conditions for Acceptance | Must Resolve Before |
|---------|-------------|---------------------------|---------------------|
| SEC-003 | Drivers can update non-status columns on assigned rides | `WITH CHECK` prevents `driver_id` tampering (most critical vector); no driver UI exists | Driver UI sprint |
| SEC-004 | Patient PII (phone, address, notes) accessible to drivers via direct Supabase query | No driver UI; all current usage is staff-only; Zod + app layer restricts displayed columns | Driver UI sprint |
| SEC-008 | No DSGVO Art. 17 erasure/anonymization procedure | No real patient data in system yet | Production launch |
| SEC-009 | No `created_by`/`updated_by` audit columns | MVP with limited users; traceability is low risk | Production launch |
| SEC-012 | No database-level text length constraints | Zod validation provides app-layer protection | Production launch |
| SEC-013 | Patient `notes` field accessible to drivers | Subsumed by SEC-004 | Driver UI sprint |

---

## 3. SEC-006 Resolution Detail — Deactivation Access Matrix

When a user is deactivated (`profiles.is_active = false`), access is blocked through two mechanisms:

1. **`get_user_role()` returns NULL** — blocks all policies that check role
2. **Session revocation** via `adminClient.auth.admin.signOut()` — invalidates refresh token

During the JWT validity window (up to 1 hour after deactivation), a deactivated user's access is:

| Resource | Access | Mechanism |
|----------|--------|-----------|
| Own profile (SELECT) | YES | `profiles_select_own` uses `id = auth.uid()` without `is_active` check (intentional — see below) |
| Other profiles | NO | `profiles_select_staff` requires `get_user_role()` — returns NULL |
| Patients | NO | Both staff and driver policies require `get_user_role()` |
| Drivers | NO | Both policies require `get_user_role()` |
| Destinations | NO | `destinations_select_all` now requires `is_active = true` via profiles lookup (fixed in `20260219_000002`) |
| Rides | NO | Both policies require `get_user_role()` |
| Ride series | NO | Policy requires `get_user_role()` |
| Driver availability | NO | Both policies require `get_user_role()` |
| Communication log (read) | NO | Both policies require `get_user_role()` |
| Communication log (write) | NO | Policy requires `get_user_role()` |

### Why `profiles_select_own` keeps no `is_active` check

A deactivated user reading their own profile allows:
- The application to display "Konto deaktiviert" (proper UX) instead of "Profil nicht gefunden"
- DSGVO Art. 15 compliance — users have the right to access their own data
- The exposed data is only the user's own name, email, role, and status — minimal risk

### Session revocation failure resilience

If `auth.admin.signOut()` fails (transient Supabase API error), the deactivation still succeeds:
- `is_active = false` is set in the database (authoritative control)
- `get_user_role()` returns NULL — blocks all role-based policies
- The user retains a valid refresh token but new JWTs still get NULL from `get_user_role()`
- Only `profiles_select_own` remains accessible — acceptable per above

---

*Reviewed by Ioannis (CISO), 2026-02-19*
*Classification: INTERNAL — VERTRAULICH*
