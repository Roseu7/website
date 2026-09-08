CREATE TABLE IF NOT EXISTS invite_codes (
  code TEXT PRIMARY KEY,
  issuer_uuid TEXT NOT NULL,
  issuer_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS whitelist_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_whitelist_pending_minecraft
  ON whitelist_applications(minecraft_uuid) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_whitelist_status_created
  ON whitelist_applications(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whitelist_discord_created
  ON whitelist_applications(discord_id, created_at DESC);

CREATE TABLE IF NOT EXISTS whitelist_trust (
  minecraft_uuid TEXT PRIMARY KEY,
  minecraft_name TEXT NOT NULL,
  state TEXT NOT NULL,
  reason TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS smanage_admins (
  minecraft_uuid TEXT PRIMARY KEY,
  minecraft_name TEXT NOT NULL,
  role TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS smanage_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO smanage_settings(setting_key, setting_value, updated_at)
VALUES ('invite_mode', 'manual', CURRENT_TIMESTAMP);
