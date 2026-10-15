ALTER TABLE email_deliveries ADD COLUMN IF NOT EXISTS delivery_transport text;
CREATE TABLE IF NOT EXISTS gmail_send_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  delivery_id uuid NOT NULL REFERENCES email_deliveries(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gmail_send_attempts_date ON gmail_send_attempts(created_at);
