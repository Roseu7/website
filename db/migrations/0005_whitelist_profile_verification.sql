ALTER TABLE whitelist_applications
  ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'verified';

ALTER TABLE whitelist_applications
  ADD COLUMN verification_source TEXT NOT NULL DEFAULT 'mojang';

CREATE INDEX idx_whitelist_verification_status
  ON whitelist_applications(server_id, verification_status, status);
