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
