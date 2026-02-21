# Ioannis (CISO) -- Agent Memory

## Project: Dispo (Fahrdienst Dispatch)

### Tech Stack
- Next.js 14 (App Router), TypeScript strict, Tailwind CSS, Supabase (Postgres + Auth + RLS), Vercel

### Data Classification (Schutzbedarf)
- Driver PII: HOCH
- Patient/Client PII: SEHR HOCH
- Transport details (routes, times): HOCH
- Health-related transport reasons: SEHR HOCH (DSGVO Art. 9 special category!)
- Auth data: HOCH

### Key Security Decisions
- Supabase region: MUST be EU (Frankfurt) -- DSGVO data residency
- Signups: Should be DISABLED (admin-only user creation) -- pending owner confirmation
- RLS: Mandatory on every table, no exceptions (also in CLAUDE.md)
- Two Supabase clients: `src/lib/supabase/client.ts` (anon) and `src/lib/supabase/server.ts` (service-role)
- Service-role key: NEVER in client-side code, each usage must be justified with a comment

### Compliance Status
- [ ] Supabase AVV/DPA: Needs signing
- [ ] Vercel AVV/DPA: Needs signing
- [ ] DSFA/DPIA: Recommended but pending owner decision (health-adjacent data)
- [ ] Verarbeitungsverzeichnis: To be created at `docs/dsgvo/verarbeitungsverzeichnis.md`
- [ ] Art. 9 applicability: Pending clarification (do transport reasons include medical purposes?)

### Security Patterns Established
- .gitignore must include: .env*, *.pem, *.key, node_modules/, .next/, .vercel
- .env.example with placeholders committed; .env.local with real values never committed
- Security headers defined in next.config.ts (CSP, HSTS, X-Frame-Options, etc.)
- NEXT_PUBLIC_ prefix = client-safe ONLY (never for secrets)

### Schema Security Review (ADR-002) -- 2026-02-18
- Full review at `docs/security/002-schema-security-review.md`
- Verdict: CONDITIONAL GO (fix CRITICALs before migration)
- CRITICAL: Role injection in handle_new_user() via raw_user_meta_data -- MUST hardcode 'operator'
- CRITICAL: SECURITY DEFINER functions missing SET search_path = public
- HIGH: rides_update_driver lacks WITH CHECK -- driver can tamper with ride details
- HIGH: Patient column-level minimization is app-only, needs DB view or compensating controls
- HIGH: Deactivated users retain access during JWT validity window
- MEDIUM: Soft delete != DSGVO Art. 17 erasure -- anonymization procedure needed
- MEDIUM: No audit log (created_by/updated_by) for DSGVO Art. 15 compliance
- MEDIUM: communication_log INSERT policy too broad (drivers can log on any ride)
- RLS pattern: All policies use get_user_role()/get_user_driver_id() helper functions
- Positive: RLS on all 8 tables, no DELETE policies, append-only comm_log, partial indexes

### Driver-Acceptance-Flow Security Review (M9) -- 2026-02-21
- Full review delivered in conversation (pending write to docs/security/)
- 3 CRITICAL, 5 HIGH, 4 MEDIUM, 3 LOW findings
- CRITICAL: Plaintext token storage (SEC-M9-001) -- must hash with SHA-256
- CRITICAL: GET for state-changing operation (SEC-M9-002) -- must convert to POST
- CRITICAL: Token not invalidated on authenticated UI action (SEC-M9-006)
- HIGH: Idempotency must be action-specific (SEC-M9-003)
- HIGH: Reminder engine needs atomic counter for exactly-once (SEC-M9-004)
- HIGH: Audit trail incomplete for token lifecycle (SEC-M9-009)
- HIGH: Token invalidation failure in assignDriver() is fire-and-forget (SEC-M9-013)
- Existing M7 positives: Good RLS on token/mail tables, atomic consumeToken, CSPRNG tokens
- Token hashing: SHA-256 sufficient (high-entropy input), NOT bcrypt/HMAC
- Rejection reasons: MUST be structured enum, NOT free text (DSGVO Art. 5(1)(c))
- Feature flags: Server-side only, never NEXT_PUBLIC_ prefix
- Email templates: Current data minimization is good, must be maintained for reminders

### Open Risks
- No pre-commit hook for secret scanning yet (gitleaks/git-secrets recommended)
- CSP requires unsafe-inline/unsafe-eval for Next.js -- monitor for nonce support
- Art. 9 applicability still unresolved -- destination_type + patient_id creates health inference

### Detailed Notes
- [Bootstrap Security Constraints](./bootstrap-security-constraints.md)
- [Schema Security Review](../../docs/security/002-schema-security-review.md)
