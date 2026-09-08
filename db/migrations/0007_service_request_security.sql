ALTER TABLE link_codes ADD COLUMN consumption_token TEXT;

CREATE TABLE service_request_nonces (
  scope TEXT NOT NULL,
  nonce TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (scope, nonce)
);
CREATE INDEX service_request_nonces_expiry ON service_request_nonces(expires_at);
