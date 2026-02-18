# Security Review: ADR-002 Database Schema Design

**Reviewer:** Ioannis (CISO)
**Date:** 2026-02-18
**ADR Under Review:** `docs/adrs/002-database-schema.md`
**Review Status:** COMPLETE
**Classification:** INTERNAL -- VERTRAULICH

---

## Executive Summary

The database schema in ADR-002 is well-structured and demonstrates strong security awareness. RLS is enabled on all 8 tables, soft deletes prevent data loss, and the role-permission matrix is clearly defined. However, I have identified **2 CRITICAL**, **4 HIGH**, **5 MEDIUM**, and **3 LOW** findings that must be addressed on the specified timelines.

The most severe finding is a **role injection vulnerability** in the `handle_new_user()` trigger that could allow privilege escalation to admin. This must be fixed before the migration is applied.

**Recommendation: CONDITIONAL GO** -- proceed with implementation after fixing the 2 CRITICAL findings. HIGH findings must be resolved before production deployment.

---

## Table of Contents

1. [Finding Summary](#1-finding-summary)
2. [RLS Policy Analysis](#2-rls-policy-analysis)
3. [DSGVO/GDPR Compliance](#3-dsgvogdpr-compliance)
4. [Authentication & Authorization](#4-authentication--authorization)
5. [Data Integrity](#5-data-integrity)
6. [STRIDE Threat Model](#6-stride-threat-model)
7. [Positive Observations](#7-positive-observations)
8. [Recommendation & Required Actions](#8-recommendation--required-actions)

---

## 1. Finding Summary

| ID | Severity | Title | Section |
|----|----------|-------|---------|
| SEC-001 | **CRITICAL** | Role injection via `handle_new_user()` trigger | 4.1 |
| SEC-002 | **CRITICAL** | `SECURITY DEFINER` functions without `search_path` pinning | 2.1 |
| SEC-003 | **HIGH** | Driver can update all columns on assigned rides, not just `status` | 2.2 |
| SEC-004 | **HIGH** | Column-level patient data minimization relies solely on application layer | 2.3 |
| SEC-005 | **HIGH** | No RLS `WITH CHECK` clause on driver ride update policy | 2.4 |
| SEC-006 | **HIGH** | Deactivated users retain access (no `is_active` check in RLS) | 2.5 |
| SEC-007 | **MEDIUM** | `profiles_insert_admin` policy blocks trigger-based profile creation | 2.6 |
| SEC-008 | **MEDIUM** | Soft delete does not satisfy DSGVO Art. 17 right to erasure | 3.1 |
| SEC-009 | **MEDIUM** | No audit log for security-relevant mutations | 3.2 |
| SEC-010 | **MEDIUM** | `communication_log` INSERT policy allows any authenticated user | 2.7 |
| SEC-011 | **MEDIUM** | Missing `is_active` filter on driver ride visibility | 2.8 |
| SEC-012 | **LOW** | No input length limits on text fields | 5.1 |
| SEC-013 | **LOW** | `notes` field on patients accessible to drivers via RLS | 2.9 |
| SEC-014 | **LOW** | Enum modification complexity (operational risk) | 5.2 |

---

## 2. RLS Policy Analysis

### 2.1 SEC-002 -- CRITICAL: `SECURITY DEFINER` Functions Without `search_path` Pinning

**Bedrohung (Threat):** The functions `get_user_role()` and `get_user_driver_id()` are declared as `SECURITY DEFINER`, meaning they execute with the permissions of the function creator (typically a superuser). If an attacker can manipulate the `search_path`, they can substitute a malicious `profiles` table in a different schema and control the return value.

**Angriffsvektor (Attack Vector):** A user with ability to create schemas or objects could create a `profiles` table in a schema that appears earlier in the `search_path`, causing the function to read from the attacker's table instead of `public.profiles`. This is a well-documented PostgreSQL SECURITY DEFINER attack pattern.

**Auswirkung (Impact):** Complete bypass of all RLS policies. An attacker could return `'admin'` from `get_user_role()` and gain unrestricted access to all data.

**Wahrscheinlichkeit (Likelihood):** LOW in Supabase managed environment (users cannot create schemas easily), but the fix is trivial and this is a defense-in-depth requirement.

**Empfohlene Massnahme (Recommended Control):**

```sql
-- Pin search_path to prevent schema substitution attacks
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles
  WHERE id = auth.uid() AND is_active = true;
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_user_driver_id()
RETURNS uuid AS $$
  SELECT driver_id FROM public.profiles
  WHERE id = auth.uid() AND is_active = true;
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public;
```

Additionally, explicitly revoke execute from `public` and grant only to `authenticated`:

```sql
REVOKE ALL ON FUNCTION public.get_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;

REVOKE ALL ON FUNCTION public.get_user_driver_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_driver_id() TO authenticated;
```

**Compliance-Bezug:** ISO 27001 A.8.3 (access restriction), CIS PostgreSQL Benchmark 4.3

---

### 2.2 SEC-003 -- HIGH: Driver Can Update All Columns on Assigned Rides

**Bedrohung:** The `rides_update_driver` policy allows drivers to update ANY column on their assigned rides, not just `status`. A driver could change `patient_id`, `destination_id`, `date`, `pickup_time`, `notes`, or even `driver_id` (reassign to another driver or set to NULL).

**Angriffsvektor:** A driver using the Supabase client directly (bypassing the application UI) sends an UPDATE to `rides` setting `driver_id = NULL` or `patient_id` to a different patient, or `is_active = false` to delete a ride.

**Auswirkung:**
- **Tampering:** Driver could alter ride details to cover tracks or cause confusion
- **Denial of Service:** Driver could deactivate rides they do not want to do
- **Information Disclosure:** By changing `patient_id`, a driver could cycle through patients and see their data via the `patients_select_driver` policy

**Empfohlene Massnahme:**

Restrict what columns a driver can update using a `WITH CHECK` clause combined with application-layer column restrictions. At the database level, the most robust approach is a column-privilege grant:

```sql
-- Option A: Use a restrictive UPDATE policy with WITH CHECK
-- Ensure the driver cannot change the driver assignment or patient
CREATE POLICY rides_update_driver ON public.rides
  FOR UPDATE USING (
    public.get_user_role() = 'driver'
    AND driver_id = public.get_user_driver_id()
  )
  WITH CHECK (
    public.get_user_role() = 'driver'
    AND driver_id = public.get_user_driver_id()
  );

-- Option B (stronger): Use column-level GRANT
-- Revoke UPDATE on rides from authenticated, grant only specific columns
-- Note: This approach requires careful coordination with staff policies
```

The `WITH CHECK` clause at minimum ensures the driver cannot change `driver_id` away from their own ID (the UPDATE would fail the CHECK). But they could still modify `patient_id`, `date`, etc. The application layer MUST also restrict which columns are in the UPDATE statement for driver operations.

**Best practice for Phase 2:** Create a dedicated `update_ride_status()` function that drivers call instead of direct table UPDATE, limiting them to status transitions only.

**Compliance-Bezug:** OWASP Broken Access Control (A01:2021), ISO 27001 A.8.3

---

### 2.3 SEC-004 -- HIGH: Column-Level Patient Data Minimization Is Application-Only

**Bedrohung:** The ADR explicitly acknowledges that column-level restriction for drivers (showing only `first_name`, `last_name`) is enforced at the application layer. If a developer writes a query that selects `*` from patients in a driver context, the driver sees phone, address, and notes.

**Angriffsvektor:**
1. A bug in application code selects all columns
2. A driver uses the Supabase JS client directly from their browser (the anon key is public) and queries `patients` with `SELECT *`
3. A future developer adds a new driver-facing feature and forgets the column restriction

**Auswirkung:** Patient PII exposure (phone, address, medical-adjacent notes). Given our Schutzbedarf classification of SEHR HOCH for patient data, this is a significant risk.

**Empfohlene Massnahme:**

Create a database VIEW for driver access that exposes only permitted columns:

```sql
CREATE VIEW public.patients_driver_view AS
  SELECT id, first_name, last_name
  FROM public.patients;

-- Grant SELECT on the view to authenticated role
GRANT SELECT ON public.patients_driver_view TO authenticated;

-- The view inherits RLS from the underlying table,
-- but only exposes the columns we want drivers to see.
```

Alternatively, for MVP, accept this risk with the following compensating controls:
1. Document the pattern prominently in a developer security guide
2. Add a code review checklist item: "Driver queries MUST NOT select patient columns beyond first_name, last_name"
3. Add an automated test that verifies driver API responses contain only allowed patient fields

**Severity rationale:** HIGH because patient data is Schutzbedarf SEHR HOCH and the attack requires only a browser console with the public anon key.

**Compliance-Bezug:** DSGVO Art. 5(1)(c) Datenminimierung, ISO 27001 A.8.11

---

### 2.4 SEC-005 -- HIGH: Missing `WITH CHECK` on Driver Ride Update Policy

**Bedrohung:** The `rides_update_driver` policy has a `USING` clause but no `WITH CHECK` clause. In PostgreSQL RLS, when `WITH CHECK` is omitted, it defaults to the `USING` expression. However, this means the policy only validates the OLD row, not the NEW row after the update.

**Angriffsvektor:** A driver could update their assigned ride and set `driver_id` to a different driver's ID. The `USING` clause passes (the old row has their `driver_id`), but the new row now points to someone else. On the next query, this ride "disappears" from the original driver and "appears" for another driver. More critically, the driver has effectively tampered with dispatch assignments.

**Auswirkung:** Dispatch integrity compromise. A malicious driver could reassign rides or remove their own assignments. Combined with SEC-003, this is a significant authorization gap.

**Empfohlene Massnahme:**

Always add explicit `WITH CHECK` to UPDATE policies:

```sql
CREATE POLICY rides_update_driver ON public.rides
  FOR UPDATE
  USING (
    public.get_user_role() = 'driver'
    AND driver_id = public.get_user_driver_id()
  )
  WITH CHECK (
    public.get_user_role() = 'driver'
    AND driver_id = public.get_user_driver_id()
  );
```

This ensures the NEW row must also satisfy the constraint -- the driver cannot change `driver_id` to anything other than their own ID.

**Compliance-Bezug:** OWASP Broken Access Control, ISO 27001 A.8.3

---

### 2.5 SEC-006 -- HIGH: Deactivated Users Retain Data Access

**Bedrohung:** Setting a profile's `is_active = false` is intended to deactivate a user. However, the `get_user_role()` function checks `is_active = true`, which means it returns NULL for deactivated users. The RLS policies then evaluate `NULL IN ('admin', 'operator')` which is FALSE -- so staff policies block them. Good.

**However**, there is a gap: The `profiles_select_own` policy uses `id = auth.uid()` with NO `is_active` check. A deactivated user can still read their own profile. More importantly, the `destinations_select_all` policy uses only `auth.uid() IS NOT NULL`, which passes for any authenticated user regardless of `is_active` status.

The real risk: A deactivated user's Supabase Auth session may still be valid (JWT not expired, refresh token not revoked). During that window, they retain access to destinations and their own profile.

**Angriffsvektor:** An admin deactivates a user by setting `is_active = false`. The user still has a valid JWT (up to 1 hour by default). During this window, the user can still query the system. If they are a driver, `get_user_role()` returns NULL, which blocks most policies. But `destinations_select_all` still works.

**Empfohlene Massnahme:**

1. **Immediate:** When deactivating a user, also revoke their Supabase Auth session via the admin API:
   ```typescript
   // Server Action: deactivate user
   await supabaseAdmin.auth.admin.signOut(userId);  // or deleteUser if appropriate
   ```

2. **Defense in depth:** Add `is_active` check to `profiles_select_own`:
   ```sql
   CREATE POLICY profiles_select_own ON public.profiles
     FOR SELECT USING (id = auth.uid() AND is_active = true);
   ```

3. **Consider:** Adding a `get_user_is_active()` SECURITY DEFINER function and checking it in all policies, or adding an `is_active` check to `get_user_role()` (which it already has -- good).

**Compliance-Bezug:** ISO 27001 A.5.18 (access rights), A.8.2 (privileged access)

---

### 2.6 SEC-007 -- MEDIUM: `profiles_insert_admin` Policy May Block Trigger Execution

**Bedrohung:** The `profiles_insert_admin` policy requires `get_user_role() = 'admin'` for INSERT on profiles. The `handle_new_user()` trigger fires AFTER INSERT on `auth.users` and attempts to INSERT into `profiles`. This trigger runs as `SECURITY DEFINER`, so it executes with the definer's permissions.

**Analysis:** Because the trigger function is `SECURITY DEFINER`, it runs with the privileges of the function owner (typically the migration role / superuser). In Supabase, `SECURITY DEFINER` functions bypass RLS by default when the definer is a superuser. So the trigger should work.

**However**, this is fragile:
- If the function owner is changed or if Supabase changes its privilege model, the trigger could break silently
- The behavior depends on implicit Supabase superuser semantics

**Empfohlene Massnahme:**

Make the bypass explicit. The `handle_new_user()` function should also have `SET search_path = public` and the dependency on superuser bypass should be documented:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.email),
    'operator'  -- HARDCODED: see SEC-001
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;
```

**Compliance-Bezug:** ISO 27001 A.8.5 (secure authentication)

---

### 2.7 SEC-010 -- MEDIUM: `communication_log` INSERT Policy Overly Permissive

**Bedrohung:** The `comm_log_insert_auth` policy allows ANY authenticated user to insert into `communication_log`, as long as `author_id = auth.uid()`. This means:
- A driver can insert log entries for rides they are NOT assigned to
- A deactivated user (with valid JWT) can insert log entries

**Angriffsvektor:** A driver queries ride IDs (which they can see for their own rides) and then inserts communication_log entries for OTHER rides by guessing or enumerating ride UUIDs.

**Auswirkung:** A driver could pollute the communication log of rides they have no involvement in. This is a data integrity issue for the audit trail.

**Empfohlene Massnahme:**

```sql
CREATE POLICY comm_log_insert_auth ON public.communication_log
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND author_id = auth.uid()
    AND (
      -- Staff can log on any ride
      public.get_user_role() IN ('admin', 'operator')
      OR (
        -- Drivers can only log on their assigned rides
        public.get_user_role() = 'driver'
        AND ride_id IN (
          SELECT id FROM public.rides
          WHERE driver_id = public.get_user_driver_id()
            AND is_active = true
        )
      )
    )
  );
```

**Compliance-Bezug:** ISO 27001 A.8.15 (logging), A.8.3 (access restriction)

---

### 2.8 SEC-011 -- MEDIUM: Missing `is_active` Filter on Driver Ride Visibility

**Bedrohung:** The `rides_select_driver` policy does not filter on `is_active = true`. A deactivated (soft-deleted) ride remains visible to a driver. While not a severe data leak, it exposes information about cancelled/removed rides that a driver should no longer see.

**Current policy:**
```sql
CREATE POLICY rides_select_driver ON public.rides
  FOR SELECT USING (
    public.get_user_role() = 'driver'
    AND driver_id = public.get_user_driver_id()
  );
```

**Empfohlene Massnahme:**

Add `is_active = true`:
```sql
CREATE POLICY rides_select_driver ON public.rides
  FOR SELECT USING (
    public.get_user_role() = 'driver'
    AND driver_id = public.get_user_driver_id()
    AND is_active = true
  );
```

Note: Staff policies intentionally omit `is_active` to allow operators to see deactivated rides. This is correct for their role.

**Compliance-Bezug:** DSGVO Art. 5(1)(c) Datenminimierung

---

### 2.9 SEC-013 -- LOW: `notes` Field on Patients Accessible to Drivers via RLS

**Bedrohung:** The `patients_select_driver` policy grants row-level access to patient rows. The `notes` column on patients could contain sensitive health-adjacent information (medical conditions, accessibility details, caregiver instructions). Drivers see the full row through RLS.

**Auswirkung:** LOW -- the notes field is unlikely to contain Art. 9 special category data in practice, and the application layer restricts to `first_name`, `last_name`. But it is an additional argument for SEC-004 (database-level column restriction).

**Empfohlene Massnahme:** Address via the view recommended in SEC-004. No separate action needed.

---

## 3. DSGVO/GDPR Compliance

### 3.1 SEC-008 -- MEDIUM: Soft Delete Does Not Satisfy Art. 17 Right to Erasure

**Bedrohung:** DSGVO Art. 17 grants data subjects the right to erasure ("Recht auf Loeschung"). The schema uses `is_active = false` for soft deletion. While soft delete is acceptable during data retention periods, it does NOT constitute erasure. If a patient requests deletion of their data, setting `is_active = false` is insufficient.

**Angriffsvektor:** A patient (or their representative) exercises Art. 17. The operator sets `is_active = false`. The data still exists in the database, in backups, and in any replicated systems. This is not compliant.

**Auswirkung:** DSGVO violation. Fines under Art. 83(5) up to 20M EUR or 4% of annual global turnover.

**Empfohlene Massnahme:**

1. **Design an erasure procedure** (does not need to be in schema, but must be documented):
   - For patients: Anonymize PII fields (`first_name` -> 'GELOESCHT', `last_name` -> 'GELOESCHT', `phone` -> NULL, address fields -> NULL, `notes` -> NULL)
   - Preserve the row and its `id` for referential integrity with historical rides
   - Preserve non-PII data (mobility flags, `is_active`, timestamps) for operational statistics
   - Document retention periods for each data category

2. **Create a documented Admin Server Action** for Art. 17 erasure:
   ```typescript
   // src/actions/dsgvo/erase-patient.ts
   // Anonymizes patient PII while preserving referential integrity
   ```

3. **Add to Verarbeitungsverzeichnis**: Document that erasure = anonymization + soft delete, with justification for retained non-PII fields.

4. **Backup consideration**: Encrypted backups with defined retention periods. After backup expiry, the anonymized data is the only copy.

**Compliance-Bezug:** DSGVO Art. 17, Art. 5(1)(e) Speicherbegrenzung

---

### 3.2 SEC-009 -- MEDIUM: No Audit Log for Security-Relevant Mutations

**Bedrohung:** The ADR acknowledges that a full audit log is deferred post-MVP. For DSGVO compliance, however, we need to demonstrate that access to personal data is logged and traceable. The current schema has `created_at` and `updated_at`, but these do not record WHO made a change or WHAT was changed.

**Angriffsvektor:** An operator modifies patient data. There is no record of who did it or what the previous values were. In case of a data breach investigation or DSGVO subject access request, we cannot provide a complete audit trail.

**Auswirkung:**
- Cannot fulfill DSGVO Art. 15 (right of access -- "who processed my data?")
- Cannot demonstrate compliance with Art. 5(1)(f) (integrity and confidentiality)
- ISO 27001 audit would flag missing evidence for A.8.15 (logging) and A.8.4 (access to source code and configuration)

**Empfohlene Massnahme:**

For MVP, implement at minimum a lightweight audit approach:

1. **Add `updated_by` column** to all tables with `updated_at`:
   ```sql
   updated_by uuid REFERENCES auth.users(id)
   ```
   Set via trigger: `NEW.updated_by = auth.uid();`

2. **Add `created_by` column** to patient-facing and ride-facing tables:
   ```sql
   created_by uuid REFERENCES auth.users(id) DEFAULT auth.uid()
   ```

3. **For full audit (Phase 2):** Implement a trigger-based audit table:
   ```sql
   CREATE TABLE public.audit_log (
     id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
     table_name text NOT NULL,
     record_id uuid NOT NULL,
     action text NOT NULL, -- INSERT, UPDATE, DELETE
     old_values jsonb,
     new_values jsonb,
     user_id uuid REFERENCES auth.users(id),
     created_at timestamptz NOT NULL DEFAULT now()
   );
   ```

**Compliance-Bezug:** DSGVO Art. 5(1)(f), Art. 15, ISO 27001 A.8.15

---

### 3.3 DSGVO Art. 9 -- Special Categories (Informational)

**Assessment:** The `destination_type` enum includes values `hospital`, `doctor`, `therapy`. When a ride is created with `destination_type = 'therapy'` and a specific `patient_id`, this creates an inference that the patient undergoes therapy treatment. Under DSGVO Art. 9, data concerning health is a special category requiring explicit consent or another Art. 9(2) legal basis.

**Empfohlene Massnahme:**
1. **Legal assessment required:** The project owner must obtain legal advice on whether the combination of patient identity + destination type constitutes health data under Art. 9
2. **If Art. 9 applies:** A DSFA/DPIA is mandatory, not just recommended
3. **Technical mitigation:** Consider whether `destination_type` should be visible to drivers (currently it is, via the `destinations_select_all` policy). A driver seeing "Patient X goes to [therapy destination]" is a potential Art. 9 data processing event.

This is flagged as informational because it requires a legal decision, not a technical one. But it MUST be resolved before production.

**Compliance-Bezug:** DSGVO Art. 9, Art. 35 (DSFA/DPIA)

---

## 4. Authentication & Authorization

### 4.1 SEC-001 -- CRITICAL: Role Injection via `handle_new_user()` Trigger

**Bedrohung:** The `handle_new_user()` trigger reads the `role` from `raw_user_meta_data` and casts it directly to `user_role`:

```sql
COALESCE(
  (NEW.raw_user_meta_data ->> 'role')::user_role,
  'operator'
)
```

If `raw_user_meta_data` contains `{"role": "admin"}`, the new user gets the admin role.

**Angriffsvektor:** Even though signups are disabled in the Supabase dashboard, the Supabase Auth API endpoint `POST /auth/v1/signup` may still accept requests with custom `user_metadata`. In many Supabase configurations, the signup endpoint remains accessible even when "Enable signups" is turned off in the dashboard -- the dashboard toggle only affects the hosted UI, not necessarily the API itself.

An attacker sends:
```json
POST /auth/v1/signup
{
  "email": "attacker@example.com",
  "password": "...",
  "data": {
    "role": "admin",
    "display_name": "Attacker"
  }
}
```

Even if this signup is rejected by Supabase settings, there are edge cases:
- An admin creating a user via the Supabase Admin API passes `user_metadata` from a form. If the form is not sanitized, a crafted request could inject `role: admin`.
- A compromised admin session could escalate another user to admin via the metadata path.

**Auswirkung:** Complete privilege escalation to admin. The attacker gains full read/write access to all patient data, driver data, and ride data.

**Wahrscheinlichkeit:** MEDIUM -- depends on Supabase signup configuration, but the vector is direct and well-understood.

**Empfohlene Massnahme:**

**HARDCODE the default role. Never read it from user-supplied metadata:**

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.email),
    'operator'  -- ALWAYS operator. Role changes are admin-only via UPDATE.
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;
```

If an admin needs to create a user with a specific role, this is done in a two-step process:
1. Create the auth user (trigger creates profile with `operator` role)
2. Admin updates the profile to set the desired role via a Server Action

This is the secure pattern. The trigger is a safety net, not the primary user creation flow.

**Compliance-Bezug:** OWASP A01:2021 Broken Access Control, ISO 27001 A.8.2, A.8.5

---

### 4.2 Role Change Protection -- Assessment

**Question:** Can a user change their own role?

**Analysis:** The `profiles_update_admin` policy restricts UPDATE on profiles to users where `get_user_role() = 'admin'`. This means:
- Operators cannot change their own role -- CORRECT
- Drivers cannot change their own role -- CORRECT
- Admins CAN change any profile's role, including their own -- CORRECT (admin privilege)

**However**, there is no constraint preventing an admin from accidentally or maliciously removing their own admin role, potentially locking out all admins. Consider:

**Empfohlene Massnahme (LOW priority):**
- Add an application-layer check: at least one admin must remain active at all times
- This is not a database constraint (it would be complex), but should be enforced in the admin UI and Server Action

---

### 4.3 `driver_id` Linkage -- Assessment

**Question:** Is the `driver_id` linkage in profiles secure?

**Analysis:**
- The `UNIQUE` constraint on `driver_id` (when not null) prevents two profiles from linking to the same driver -- CORRECT
- The CHECK constraint `profile_driver_link_check` ensures `driver_id` is set if and only if `role = 'driver'` -- CORRECT
- Only admins can UPDATE profiles (including `driver_id`), per `profiles_update_admin` -- CORRECT
- A driver cannot change their own `driver_id` to point to a different driver record -- CORRECT

The linkage is well-designed. No finding.

---

## 5. Data Integrity

### 5.1 SEC-012 -- LOW: No Input Length Limits on Text Fields

**Bedrohung:** Text fields like `display_name`, `first_name`, `last_name`, `phone`, `notes`, `message`, `street`, etc. have no maximum length constraint. A malicious or accidental input could insert megabytes of data into a single field.

**Angriffsvektor:** A user submits a form with a 10MB string in the `notes` field. This passes all constraints and is stored. Repeated abuse could degrade database performance (storage, memory for queries, network transfer).

**Auswirkung:** Potential denial of service at the storage/performance level. Low likelihood because the application layer should validate input lengths, but defense in depth recommends database-level constraints.

**Empfohlene Massnahme:**

Add reasonable length limits:
```sql
-- Names
CHECK (length(first_name) BETWEEN 1 AND 200)
CHECK (length(last_name) BETWEEN 1 AND 200)
CHECK (length(display_name) BETWEEN 1 AND 200)

-- Phone
CHECK (length(phone) <= 30)

-- Address fields
CHECK (length(street) <= 300)
CHECK (length(house_number) <= 20)
CHECK (length(postal_code) <= 10)
CHECK (length(city) <= 200)

-- Notes/messages
CHECK (length(notes) <= 5000)
CHECK (length(message) <= 10000)
```

These limits should also be enforced at the application layer (Zod validation), making the database constraints a safety net.

**Compliance-Bezug:** CIS Benchmark, OWASP Input Validation

---

### 5.2 SEC-014 -- LOW: Enum Modification Complexity

**Bedrohung:** PostgreSQL enums cannot have values removed or renamed without dropping and recreating the type (which requires altering all dependent columns). Adding values is straightforward with `ALTER TYPE ... ADD VALUE`.

**Auswirkung:** Operational risk. If a `ride_status` value needs to be removed or renamed, the migration is complex and error-prone.

**Assessment:** The ADR acknowledges this and chose enums for stable value sets. This is an acceptable trade-off for MVP. The chosen values appear well-considered.

**Empfohlene Massnahme:** No action needed. Document in runbooks that enum changes require careful migration planning.

---

### 5.3 SQL Injection via Enum Types -- Assessment

**Question:** Can enum types or text fields be used as SQL injection vectors?

**Analysis:** PostgreSQL enums are type-safe at the database level. A value like `'; DROP TABLE patients; --` cannot be stored in a `user_role` column because it is not a valid enum member. The cast `(NEW.raw_user_meta_data ->> 'role')::user_role` would raise a runtime error (not execute the injection). This is safe against SQL injection.

Text fields are parameterized in Supabase queries (PostgREST/JS client), so SQL injection via application queries is not a concern as long as raw SQL string concatenation is never used.

**No finding.** The enum approach is SQL-injection-safe by design.

---

### 5.4 Foreign Key Cascade Behavior -- Assessment

**Question:** Can cascade behavior cause unintended data loss?

**Analysis:**
- `profiles.id` -> `auth.users(id)` ON DELETE CASCADE: Deleting an auth user removes the profile. Acceptable -- auth user deletion is an admin action.
- `driver_availability.driver_id` -> `drivers(id)` ON DELETE CASCADE: Deleting a driver removes their availability. Acceptable -- but since we use soft delete, hard DELETE should never happen.
- All other FKs have no cascade (default is RESTRICT/NO ACTION). Acceptable -- prevents accidental data loss.

**Potential issue:** `profiles.id` ON DELETE CASCADE from `auth.users` means if someone deletes an auth user via the Supabase admin panel, the profile vanishes. Since `communication_log.author_id` references `profiles(id)` without CASCADE, this would fail with a FK violation if the user has log entries.

**Empfohlene Massnahme:**
- Document that auth user deletion should NEVER be used directly. Instead: deactivate the profile (`is_active = false`).
- Consider adding `ON DELETE SET NULL` on `communication_log.author_id` to handle the edge case gracefully, or `ON DELETE RESTRICT` on `profiles` to prevent the cascade.

This is a LOW risk because Supabase user deletion is an admin-only action.

---

## 6. STRIDE Threat Model

### 6.1 Spoofing: Can a User Impersonate Another Role?

| Threat | Mitigation | Gap |
|--------|-----------|-----|
| User spoofs admin role via signup metadata | **SEC-001 CRITICAL** -- metadata role injection | FIX REQUIRED |
| User modifies JWT claims to change role | Supabase JWT is signed server-side; cannot be forged without JWT secret | MITIGATED |
| Driver impersonates another driver | `get_user_driver_id()` reads from profiles table, linked by auth UID | MITIGATED |
| Unauthenticated access | All RLS policies check `auth.uid()` or call `get_user_role()` which returns NULL for unauthenticated | MITIGATED |

**Residual risk:** SEC-001 must be fixed. After fix, spoofing risk is LOW.

---

### 6.2 Tampering: Can Ride Status Be Changed Illegitimately?

| Threat | Mitigation | Gap |
|--------|-----------|-----|
| Driver changes status to invalid transition | State machine enforced at application layer | Application bug could allow invalid transitions |
| Driver changes ride details (patient, destination) | **SEC-003 HIGH** -- UPDATE policy too broad | FIX REQUIRED |
| Driver backdates a ride | No constraint prevents changing `date` on assigned rides | Addressed by SEC-003 fix |
| Operator tampers with completed rides | Allowed by design (operators have full UPDATE) | ACCEPTABLE -- log it |
| User modifies `created_at`/`updated_at` | Trigger overwrites `updated_at`; `created_at` has no trigger protection | LOW -- add `created_at` to trigger |

**Residual risk:** SEC-003 must be fixed. After fix, add application-layer state machine enforcement as documented.

---

### 6.3 Repudiation: Can Actions Be Denied?

| Threat | Mitigation | Gap |
|--------|-----------|-----|
| User denies making a status change | No audit log recording who changed what | **SEC-009 MEDIUM** |
| User denies creating a communication log entry | `author_id` = `auth.uid()` enforced at INSERT | MITIGATED |
| Admin denies changing a user's role | No audit log | **SEC-009 MEDIUM** |

**Residual risk:** MEDIUM. The `updated_by` column (SEC-009) is the minimum viable fix.

---

### 6.4 Information Disclosure: Can Drivers Access Patient PII?

| Threat | Mitigation | Gap |
|--------|-----------|-----|
| Driver reads patient phone/address via direct query | Application-layer column restriction only | **SEC-004 HIGH** |
| Driver sees patient notes (medical-adjacent) | Same as above + SEC-013 | **SEC-004 HIGH** |
| Driver reads other drivers' data | RLS restricts to own driver record | MITIGATED |
| Driver reads other drivers' rides | RLS restricts to own assigned rides | MITIGATED |
| Driver infers patient health via destination type | `destinations_select_all` exposes type to all users | See 3.3 (Art. 9 assessment) |
| Deactivated user reads data during JWT validity | **SEC-006 HIGH** -- session not revoked | FIX REQUIRED |

**Residual risk:** SEC-004 and SEC-006 must be addressed. After fix, information disclosure risk is LOW-MEDIUM (destination type inference remains).

---

### 6.5 Denial of Service: Performance Concerns

| Threat | Assessment | Risk |
|--------|-----------|------|
| RLS subqueries on `patients_select_driver` (IN subquery on rides) | Subquery is on indexed columns (`driver_id`, `patient_id`). For typical driver workload (< 50 active rides), this is negligible. | LOW |
| `get_user_role()` called on every query | Single-row PK lookup, cached per statement due to `STABLE`. Under 100 concurrent users, this is negligible. | LOW |
| Text fields without length limits (SEC-012) | Storage/memory abuse | LOW |
| Overlapping availability blocks (no exclusion constraint) | Application-layer enforcement; could allow data inconsistency | LOW |

**Overall DoS risk:** LOW. The schema is well-indexed and the query patterns are bounded.

---

### 6.6 Elevation of Privilege: Can a Driver Become an Operator?

| Threat | Mitigation | Gap |
|--------|-----------|-----|
| Driver changes own role via profile UPDATE | `profiles_update_admin` restricts to admins only | MITIGATED |
| Role injection via signup metadata | **SEC-001 CRITICAL** | FIX REQUIRED |
| Driver exploits SECURITY DEFINER function | **SEC-002 CRITICAL** -- `search_path` not pinned | FIX REQUIRED |
| Driver creates new profile with elevated role | `profiles_insert_admin` restricts to admins only | MITIGATED |
| Compromised third-party dependency | Out of scope for schema review | MONITOR |

**Residual risk:** SEC-001 and SEC-002 must be fixed. After fix, elevation of privilege risk is LOW.

---

## 7. Positive Observations

The schema design shows mature security thinking in several areas:

1. **RLS on every table, no exceptions.** This is the correct baseline. Many Supabase projects skip RLS "for now" and regret it.

2. **No DELETE policies anywhere.** Soft delete enforcement at the RLS level is a strong control. Even a compromised service-role connection cannot accidentally DELETE through the application.

3. **`SECURITY DEFINER` + `STABLE` on helper functions.** The choice to centralize role lookups in cached functions is the correct Supabase RLS pattern. It avoids policy-per-table role logic duplication.

4. **CHECK constraint on `profile_driver_link_check`.** This prevents a critical data integrity issue (driver role without driver record, or non-driver with driver record). Well done.

5. **`ON CONFLICT DO NOTHING` in the trigger.** Prevents race conditions between admin pre-creation and auth trigger execution.

6. **Append-only `communication_log`.** No UPDATE, no DELETE, no `is_active`. This is exactly how an audit-adjacent log should work.

7. **`is_active` check in `get_user_role()`.** Deactivated users get NULL role, which blocks most policies. This is a good base-level deactivation mechanism.

8. **Clear role-permission matrix.** The documented matrix in Section 8 of the ADR makes security review straightforward. This is an underrated practice.

9. **Partial indexes for active records.** Not directly a security feature, but prevents the performance degradation that causes teams to "temporarily disable RLS for speed" -- a common and dangerous anti-pattern.

---

## 8. Recommendation & Required Actions

### Verdict: CONDITIONAL GO

The schema may proceed to implementation **after** the following CRITICAL fixes are applied to the migration SQL:

#### Must Fix BEFORE Migration (Blocker)

| ID | Action | Effort |
|----|--------|--------|
| SEC-001 | Hardcode `'operator'` role in `handle_new_user()`, remove metadata role reading | 5 min |
| SEC-002 | Add `SET search_path = public` to both SECURITY DEFINER functions, add REVOKE/GRANT | 5 min |

#### Must Fix BEFORE Production

| ID | Action | Effort |
|----|--------|--------|
| SEC-003 | Add `WITH CHECK` to `rides_update_driver` matching USING clause; plan column-restricted update function for Phase 2 | 30 min |
| SEC-004 | Create `patients_driver_view` OR document compensating controls (automated test + code review checklist) | 1-2 hrs |
| SEC-005 | (Merged with SEC-003 -- same fix) | -- |
| SEC-006 | Implement session revocation on user deactivation; add `is_active` check to `profiles_select_own` | 1 hr |

#### Should Fix Before Phase 2

| ID | Action | Effort |
|----|--------|--------|
| SEC-007 | Add `SET search_path = public` to `handle_new_user()` (partially done via SEC-001) | 5 min |
| SEC-008 | Design and document Art. 17 erasure procedure | 2-4 hrs |
| SEC-009 | Add `created_by` and `updated_by` columns; plan full audit log | 2-4 hrs |
| SEC-010 | Restrict `communication_log` INSERT to ride-authorized users | 30 min |
| SEC-011 | Add `is_active = true` filter to driver ride SELECT policy | 5 min |

#### Monitor / Accept for MVP

| ID | Action | Effort |
|----|--------|--------|
| SEC-012 | Add text length constraints | 1 hr |
| SEC-013 | Addressed by SEC-004 | -- |
| SEC-014 | No action; document in runbook | -- |

---

### Compliance Mapping Summary

| Control Area | Status | DSGVO | ISO 27001 |
|-------------|--------|-------|-----------|
| Access Control (RLS) | Strong with gaps | Art. 5(1)(f) | A.8.3, A.8.4 |
| Data Minimization | App-layer only | Art. 5(1)(c) | A.8.11 |
| Right to Erasure | NOT addressed | Art. 17 | -- |
| Audit Trail | Partial (`updated_at` only) | Art. 5(1)(f), 15 | A.8.15 |
| Privilege Management | Strong with SEC-001 fix | Art. 5(1)(f) | A.8.2 |
| Encryption at Rest | Supabase-managed (verify!) | Art. 32 | A.8.24 |
| Logging | `communication_log` only | Art. 5(1)(f) | A.8.15 |

---

### Next Steps

1. Martin applies CRITICAL fixes (SEC-001, SEC-002) to the migration SQL
2. Martin applies HIGH fixes (SEC-003/005, SEC-006) to the migration SQL
3. I review the final migration SQL before it is applied
4. Compliance items (SEC-008, SEC-009, Art. 9 legal assessment) are tracked as separate tickets
5. SEC-004 compensating controls are documented in the developer security guide

---

*Review performed by Ioannis (CISO). For questions, raise them in the security channel.*
*This document is classified INTERNAL -- VERTRAULICH. Do not share outside the project team.*
