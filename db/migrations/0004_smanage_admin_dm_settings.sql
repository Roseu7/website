CREATE TABLE IF NOT EXISTS smanage_admin_dm_settings (
  server_id TEXT NOT NULL,
  minecraft_uuid TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (server_id, minecraft_uuid)
);
