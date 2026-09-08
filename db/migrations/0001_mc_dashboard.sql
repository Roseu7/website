CREATE TABLE IF NOT EXISTS discord_users (
  discord_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  global_name TEXT,
  avatar_hash TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mc_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_id TEXT NOT NULL,
  minecraft_uuid TEXT NOT NULL,
  minecraft_name TEXT NOT NULL,
  linked_at TEXT NOT NULL,
  unlinked_at TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mc_links_active_discord
  ON mc_links(discord_id) WHERE active = 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mc_links_active_minecraft
  ON mc_links(minecraft_uuid) WHERE active = 1;

CREATE TABLE IF NOT EXISTS link_codes (
  code TEXT PRIMARY KEY,
  minecraft_uuid TEXT NOT NULL,
  minecraft_name TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  consumed_at TEXT
);

CREATE TABLE IF NOT EXISTS server_state (
  server_id TEXT PRIMARY KEY,
  online INTEGER NOT NULL,
  player_count INTEGER NOT NULL,
  max_players INTEGER NOT NULL DEFAULT 0,
  players_json TEXT NOT NULL,
  checked_at TEXT NOT NULL
);
