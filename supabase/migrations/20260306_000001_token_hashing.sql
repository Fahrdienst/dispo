-- Token Hashing Migration: SEC-M9-001 (CRITICAL)
-- Converts plaintext tokens to SHA-256 hashes for secure storage
-- Also adds action column (SEC-M9-003) and reminders_sent (SEC-M9-004)

-- 1. Rename token column to token_hash
ALTER TABLE assignment_tokens RENAME COLUMN token TO token_hash;

-- 2. Hash existing tokens in-place (SHA-256, hex-encoded)
UPDATE assignment_tokens
SET token_hash = encode(sha256(token_hash::bytea), 'hex')
WHERE token_hash IS NOT NULL;

-- 3. Add action column for idempotency (SEC-M9-003)
-- Stores the action that consumed the token (confirm/reject)
ALTER TABLE assignment_tokens ADD COLUMN action text;

-- 4. Add reminders_sent counter (SEC-M9-004)
ALTER TABLE assignment_tokens ADD COLUMN reminders_sent integer NOT NULL DEFAULT 0;

-- 5. Drop the old unique constraint on token (now token_hash), then create new index
ALTER TABLE assignment_tokens DROP CONSTRAINT IF EXISTS assignment_tokens_token_key;
CREATE UNIQUE INDEX idx_assignment_tokens_hash ON assignment_tokens (token_hash);
