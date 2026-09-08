CREATE TABLE whitelist_discord_notifications (
  application_id INTEGER NOT NULL,
  discord_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (application_id, discord_id)
);

CREATE INDEX idx_whitelist_discord_notifications_application
  ON whitelist_discord_notifications(application_id);
