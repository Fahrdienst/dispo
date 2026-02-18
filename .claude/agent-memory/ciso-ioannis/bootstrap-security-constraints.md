# Bootstrap Security Constraints (2026-02-18)

## Threat Model Summary (Setup Phase)
1. KRITISCH: Secret leakage via git history (no .gitignore exists yet!)
2. HIGH: Supabase anon key misuse without RLS
3. HIGH: Overly permissive Supabase defaults not hardened
4. MEDIUM: Supply chain / dependency compromise
5. HIGH: Missing security headers enabling browser-side attacks

## Environment Variables
| Variable | Secret? | Client-Safe? |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | No | Yes |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | No* | Yes |
| SUPABASE_SERVICE_ROLE_KEY | YES | NEVER |
| SUPABASE_DB_URL | YES | NEVER |
| SUPABASE_JWT_SECRET | YES | NEVER |

*Anon key is public but only safe because RLS restricts access.

## Supabase Auth Settings (Required)
- Email confirmation: ENABLED
- Signup: DISABLED (admin-only)
- Min password length: 8+ (12 recommended)
- JWT expiry: 3600s
- Refresh token rotation: ENABLED
- Reuse interval: 10s

## Security Headers (for next.config.ts)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()
- Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
- Content-Security-Policy: restrictive baseline (see main output)

## DSGVO Requirements (Bootstrap)
- Supabase in EU region (Frankfurt)
- AVV/DPA with Supabase and Vercel
- Verarbeitungsverzeichnis to be created
- DSFA/DPIA recommended (health-adjacent data)
- Art. 9 applicability needs clarification from project owner
