CREATE TABLE IF NOT EXISTS employer_sources (
  source text PRIMARY KEY, provider text NOT NULL CHECK(provider IN ('greenhouse','lever','smartrecruiters')),
  slug text NOT NULL, company text NOT NULL, origin text NOT NULL CHECK(origin IN ('seeded','discovered')),
  verified_at timestamptz, last_attempt_at timestamptz, last_status text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS employers_check_priority ON employer_sources(origin,last_attempt_at,source);
CREATE TABLE IF NOT EXISTS discovery_candidates (
  source text PRIMARY KEY, provider text NOT NULL, slug text NOT NULL, board_url text NOT NULL,
  query text NOT NULL, discovered_at timestamptz NOT NULL, status text NOT NULL DEFAULT 'pending',
  next_attempt_at timestamptz NOT NULL, attempts integer NOT NULL DEFAULT 0,
  lease_token uuid, lease_expires_at timestamptz, company text, matched integer, error text
);
CREATE INDEX IF NOT EXISTS candidates_due ON discovery_candidates(next_attempt_at,discovered_at,source);
CREATE TABLE IF NOT EXISTS discovery_requests (
  id uuid PRIMARY KEY, reserved_at timestamptz NOT NULL, query_index bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS discovery_requests_time ON discovery_requests(reserved_at);
CREATE TABLE IF NOT EXISTS discovery_state (
  id boolean PRIMARY KEY DEFAULT true CHECK(id), next_query_index bigint NOT NULL DEFAULT 0,
  lease_token uuid, lease_expires_at timestamptz
);
INSERT INTO discovery_state(id) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS discovery_runs (
  id uuid PRIMARY KEY, started_at timestamptz NOT NULL, completed_at timestamptz,
  status text NOT NULL, summary jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS discovery_runs_completed ON discovery_runs(completed_at DESC);
