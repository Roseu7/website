CREATE TABLE IF NOT EXISTS managed_servers (
  server_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  discord_guild_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO managed_servers(
  server_id, display_name, discord_guild_id, enabled, created_at, updated_at
) VALUES ('nikoserver', 'Niko Server', '', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS whitelist_trust_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  minecraft_uuid TEXT NOT NULL,
  minecraft_name TEXT NOT NULL,
  state TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS smanage_discord_links (
  minecraft_uuid TEXT PRIMARY KEY,
  minecraft_name TEXT NOT NULL,
  discord_id TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS whitelist_review_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL,
  minecraft_name TEXT NOT NULL,
  status TEXT NOT NULL,
  reviewer_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  game_notified INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE invite_codes RENAME TO invite_codes_legacy;
ALTER TABLE whitelist_applications RENAME TO whitelist_applications_legacy;
ALTER TABLE whitelist_trust RENAME TO whitelist_trust_legacy;
ALTER TABLE whitelist_trust_events RENAME TO whitelist_trust_events_legacy;
ALTER TABLE smanage_admins RENAME TO smanage_admins_legacy;
ALTER TABLE smanage_settings RENAME TO smanage_settings_legacy;
ALTER TABLE whitelist_review_events RENAME TO whitelist_review_events_legacy;

CREATE TABLE invite_codes (
  code TEXT PRIMARY KEY,
  server_id TEXT NOT NULL,
  issuer_uuid TEXT NOT NULL,
  issuer_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE whitelist_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id TEXT NOT NULL,
  minecraft_uuid TEXT NOT NULL,
  minecraft_name TEXT NOT NULL,
  discord_id TEXT NOT NULL,
  invite_code TEXT NOT NULL,
  inviter_uuid TEXT NOT NULL,
  inviter_name TEXT NOT NULL,
  status TEXT NOT NULL,
  mode_at_submission TEXT NOT NULL,
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewed_by_uuid TEXT,
  reviewed_by_name TEXT,
  review_note TEXT,
  whitelist_synced INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE whitelist_trust (
  server_id TEXT NOT NULL,
  minecraft_uuid TEXT NOT NULL,
  minecraft_name TEXT NOT NULL,
  state TEXT NOT NULL,
  reason TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (server_id, minecraft_uuid)
);

CREATE TABLE whitelist_trust_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id TEXT NOT NULL,
  minecraft_uuid TEXT NOT NULL,
  minecraft_name TEXT NOT NULL,
  state TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE smanage_admins (
  server_id TEXT NOT NULL,
  minecraft_uuid TEXT NOT NULL,
  minecraft_name TEXT NOT NULL,
  role TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (server_id, minecraft_uuid)
);

CREATE TABLE smanage_settings (
  server_id TEXT NOT NULL,
  setting_key TEXT NOT NULL,
  setting_value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (server_id, setting_key)
);

CREATE TABLE whitelist_review_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id TEXT NOT NULL,
  application_id INTEGER NOT NULL,
  minecraft_name TEXT NOT NULL,
  status TEXT NOT NULL,
  reviewer_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  game_notified INTEGER NOT NULL DEFAULT 0
);

INSERT INTO invite_codes(
  code, server_id, issuer_uuid, issuer_name, created_at, expires_at, active, used_count
)
SELECT code, 'nikoserver', issuer_uuid, issuer_name, created_at, expires_at, active, used_count
FROM invite_codes_legacy;

INSERT INTO whitelist_applications(
  id, server_id, minecraft_uuid, minecraft_name, discord_id, invite_code,
  inviter_uuid, inviter_name, status, mode_at_submission, created_at,
  reviewed_at, reviewed_by_uuid, reviewed_by_name, review_note, whitelist_synced
)
SELECT id, 'nikoserver', minecraft_uuid, minecraft_name, discord_id, invite_code,
  inviter_uuid, inviter_name, status, mode_at_submission, created_at,
  reviewed_at, reviewed_by_uuid, reviewed_by_name, review_note, whitelist_synced
FROM whitelist_applications_legacy;

INSERT INTO whitelist_trust(
  server_id, minecraft_uuid, minecraft_name, state, reason, updated_at
)
SELECT 'nikoserver', minecraft_uuid, minecraft_name, state, reason, updated_at
FROM whitelist_trust_legacy;

INSERT INTO whitelist_trust_events(
  id, server_id, minecraft_uuid, minecraft_name, state, reason, created_at
)
SELECT id, 'nikoserver', minecraft_uuid, minecraft_name, state, reason, created_at
FROM whitelist_trust_events_legacy;

INSERT INTO smanage_admins(
  server_id, minecraft_uuid, minecraft_name, role, active, updated_at
)
SELECT 'nikoserver', minecraft_uuid, minecraft_name, role, active, updated_at
FROM smanage_admins_legacy;

INSERT INTO smanage_settings(server_id, setting_key, setting_value, updated_at)
SELECT 'nikoserver', setting_key, setting_value, updated_at
FROM smanage_settings_legacy;

INSERT INTO whitelist_review_events(
  id, server_id, application_id, minecraft_name, status, reviewer_name, created_at, game_notified
)
SELECT id, 'nikoserver', application_id, minecraft_name, status, reviewer_name, created_at, game_notified
FROM whitelist_review_events_legacy;

DROP TABLE invite_codes_legacy;
DROP TABLE whitelist_applications_legacy;
DROP TABLE whitelist_trust_legacy;
DROP TABLE whitelist_trust_events_legacy;
DROP TABLE smanage_admins_legacy;
DROP TABLE smanage_settings_legacy;
DROP TABLE whitelist_review_events_legacy;

CREATE UNIQUE INDEX idx_whitelist_pending_minecraft
  ON whitelist_applications(server_id, minecraft_uuid) WHERE status = 'pending';
CREATE INDEX idx_whitelist_status_created
  ON whitelist_applications(server_id, status, created_at DESC);
CREATE INDEX idx_whitelist_discord_created
  ON whitelist_applications(server_id, discord_id, created_at DESC);
