-- Migrate with: npx wrangler d1 execute albot-konfigurator --remote --file=./schema.sql
CREATE TABLE IF NOT EXISTS character_snapshots (
 name TEXT PRIMARY KEY NOT NULL,
 updated_at INTEGER NOT NULL,
 realm TEXT NOT NULL,
 map TEXT NOT NULL,
 payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_character_updated ON character_snapshots(updated_at);
CREATE TABLE IF NOT EXISTS bank_snapshots (
 key TEXT PRIMARY KEY NOT NULL,
 updated_at INTEGER NOT NULL,
 realm TEXT NOT NULL,
 map TEXT NOT NULL,
 payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bank_updated ON bank_snapshots(updated_at);
-- Canonical bank_snapshots.key is the account-wide pack name (e.g. items0).
-- Historic realm:pack keys are kept as read-only legacy observations; new writes
-- use the pack key alone. 'realm' records the observing server, not inventory scope.
-- These rows are telemetry only, not authoritative in-game bank transaction evidence.

-- Additive, optional private signed-PUBLICATION high-water (NOT applied).
-- Execute explicitly on the existing Free-tier D1 database before invoking
-- /api/profile-sync/signed-highwater. Never reset or DROP this table.
CREATE TABLE IF NOT EXISTS signed_config_highwater (
 target TEXT PRIMARY KEY NOT NULL,
 key_id TEXT NOT NULL,
 sequence INTEGER NOT NULL CHECK(sequence > 0),
 sha256 TEXT NOT NULL,
 release_sha TEXT NOT NULL,
 updated_at INTEGER NOT NULL CHECK(updated_at > 0)
);
-- One row per pinned signing target; atomic UPSERT guards downgrade/equivocation.
-- No profile bytes, JWTs, signing secrets, browser IDs or per-character ACKs.
