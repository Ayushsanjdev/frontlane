CREATE TABLE IF NOT EXISTS saved_searches(id uuid PRIMARY KEY,user_id text NOT NULL,name text NOT NULL,criteria text NOT NULL,enabled boolean NOT NULL DEFAULT true,boundary bigint NOT NULL DEFAULT 0,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS saved_searches_owner ON saved_searches(user_id);
CREATE TABLE IF NOT EXISTS job_notifications(id uuid PRIMARY KEY,user_id text NOT NULL,search_id uuid NOT NULL REFERENCES saved_searches(id) ON DELETE CASCADE,canonical_url text NOT NULL,job jsonb NOT NULL,read_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(user_id,search_id,canonical_url));
CREATE INDEX IF NOT EXISTS notifications_owner_date ON job_notifications(user_id,created_at DESC);
