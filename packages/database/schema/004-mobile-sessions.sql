CREATE TABLE IF NOT EXISTS mobile_sessions (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL,
  payload jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mobile_sessions_user ON mobile_sessions(user_id);
CREATE INDEX IF NOT EXISTS mobile_sessions_expiry ON mobile_sessions(expires_at);
