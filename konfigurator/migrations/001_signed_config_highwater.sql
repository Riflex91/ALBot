-- ALBot protected signed-publication high-water ONLY.
-- Additive and idempotent; never touch existing telemetry tables/rows.
-- Records signed releases, NOT game application or character ACK.
CREATE TABLE IF NOT EXISTS signed_config_highwater (
 target TEXT PRIMARY KEY NOT NULL,
 key_id TEXT NOT NULL,
 sequence INTEGER NOT NULL CHECK(sequence > 0),
 sha256 TEXT NOT NULL,
 release_sha TEXT NOT NULL,
 updated_at INTEGER NOT NULL CHECK(updated_at > 0)
);
